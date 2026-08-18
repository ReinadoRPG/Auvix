import { socketService } from './socket';
import { webrtcApi } from './api';

export interface PeerStreamData {
  userId: string;
  stream: MediaStream;
  hasAudio: boolean;
  hasVideo: boolean;
  hasScreen: boolean;
}

type OnRemoteStreamCallback = (userId: string, stream: MediaStream) => void;
type OnRemoteStreamRemovedCallback = (userId: string) => void;
type OnSpeakingCallback = (isSpeaking: boolean) => void;

class WebRTCManager {
  private peers: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }
  ];

  private currentChannelId: string | null = null;
  private currentUserId: string | null = null;

  // Local Media Streams
  private localAudioStream: MediaStream | null = null;
  private localVideoStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;

  // Audio Analysis
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private isLocallySpeaking = false;

  // States
  private isMuted = false;
  private isDeafened = false;
  private isCameraOn = false;
  private isScreenSharing = false;

  // Callbacks
  private onRemoteStreamAdd?: OnRemoteStreamCallback;
  private onRemoteStreamRemove?: OnRemoteStreamRemovedCallback;
  private onSpeakingChange?: OnSpeakingCallback;

  public async init() {
    try {
      const config = await webrtcApi.getIceConfig();
      if (config.iceServers && config.iceServers.length > 0) {
        this.iceServers = config.iceServers;
      }
    } catch (err) {
      console.warn('[WebRTC] Using fallback STUN servers:', err);
    }
  }

  public setCallbacks(callbacks: {
    onRemoteStreamAdd: OnRemoteStreamCallback;
    onRemoteStreamRemove: OnRemoteStreamRemovedCallback;
    onSpeakingChange?: OnSpeakingCallback;
  }) {
    this.onRemoteStreamAdd = callbacks.onRemoteStreamAdd;
    this.onRemoteStreamRemove = callbacks.onRemoteStreamRemove;
    this.onSpeakingChange = callbacks.onSpeakingChange;
  }

  public async startVoiceSession(channelId: string, userId: string): Promise<MediaStream | null> {
    this.currentChannelId = channelId;
    this.currentUserId = userId;

    // Acquire microphone stream
    try {
      this.localAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.setupAudioAnalysis(this.localAudioStream);
    } catch (err) {
      console.error('[WebRTC] Could not capture microphone:', err);
      // Still allow joining session even if mic is denied/unavailable
    }

    return this.localAudioStream;
  }

  public async toggleMute(muted?: boolean): Promise<boolean> {
    this.isMuted = muted !== undefined ? muted : !this.isMuted;
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach(track => {
        track.enabled = !this.isMuted;
      });
    }

    if (this.currentChannelId) {
      socketService.updateVoiceState({
        channelId: this.currentChannelId,
        isMuted: this.isMuted,
      });
    }

    return this.isMuted;
  }

  public toggleDeafen(deafened?: boolean): boolean {
    this.isDeafened = deafened !== undefined ? deafened : !this.isDeafened;
    // If deafened, mute as well
    if (this.isDeafened && !this.isMuted) {
      this.toggleMute(true);
    }

    if (this.currentChannelId) {
      socketService.updateVoiceState({
        channelId: this.currentChannelId,
        isDeafened: this.isDeafened,
        isMuted: this.isMuted,
      });
    }

    return this.isDeafened;
  }

  public async toggleCamera(): Promise<boolean> {
    if (this.isCameraOn) {
      // Turn off camera
      if (this.localVideoStream) {
        this.localVideoStream.getTracks().forEach(t => t.stop());
        this.localVideoStream = null;
      }
      this.isCameraOn = false;
      this.updateVideoTrackOnPeers(null);
    } else {
      // Turn on camera
      try {
        this.localVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        this.isCameraOn = true;
        const videoTrack = this.localVideoStream.getVideoTracks()[0];
        this.updateVideoTrackOnPeers(videoTrack);
      } catch (err) {
        console.error('[WebRTC] Error starting camera:', err);
        this.isCameraOn = false;
        throw new Error('Não foi possível acessar a câmera.');
      }
    }

    if (this.currentChannelId) {
      socketService.updateVoiceState({
        channelId: this.currentChannelId,
        isCameraOn: this.isCameraOn,
      });
    }

    return this.isCameraOn;
  }

  public async startScreenShare(): Promise<MediaStream> {
    try {
      this.localScreenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      this.isScreenSharing = true;
      const screenVideoTrack = this.localScreenStream.getVideoTracks()[0];

      // Handle user stopping screen share via native browser bar
      screenVideoTrack.onended = () => {
        this.stopScreenShare();
      };

      this.updateVideoTrackOnPeers(screenVideoTrack);

      if (this.currentChannelId) {
        socketService.updateVoiceState({
          channelId: this.currentChannelId,
          isScreenSharing: true,
        });
      }

      return this.localScreenStream;
    } catch (err) {
      console.error('[WebRTC] Error starting screen share:', err);
      this.isScreenSharing = false;
      throw err;
    }
  }

  public stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(t => t.stop());
      this.localScreenStream = null;
    }
    this.isScreenSharing = false;

    // Restore camera track if camera is on, otherwise null
    const videoTrack = (this.isCameraOn && this.localVideoStream)
      ? this.localVideoStream.getVideoTracks()[0]
      : null;

    this.updateVideoTrackOnPeers(videoTrack);

    if (this.currentChannelId) {
      socketService.updateVoiceState({
        channelId: this.currentChannelId,
        isScreenSharing: false,
      });
    }
  }

  // --- Peer Connection Handling ---

  public async connectToPeer(remoteUserId: string, createOffer = false) {
    if (this.peers.has(remoteUserId)) {
      return this.peers.get(remoteUserId)!;
    }

    const peer = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peers.set(remoteUserId, peer);

    // Add local tracks to peer
    if (this.localAudioStream) {
      this.localAudioStream.getAudioTracks().forEach(track => {
        peer.addTrack(track, this.localAudioStream!);
      });
    }

    const activeVideoTrack = this.isScreenSharing && this.localScreenStream
      ? this.localScreenStream.getVideoTracks()[0]
      : (this.isCameraOn && this.localVideoStream ? this.localVideoStream.getVideoTracks()[0] : null);

    if (activeVideoTrack) {
      const activeStream = this.isScreenSharing ? this.localScreenStream! : this.localVideoStream!;
      peer.addTrack(activeVideoTrack, activeStream);
    }

    // ICE Candidate generation
    peer.onicecandidate = (event) => {
      if (event.candidate && this.currentChannelId) {
        socketService.sendIceCandidate(remoteUserId, this.currentChannelId, event.candidate.toJSON());
      }
    };

    // Remote Track received
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && this.onRemoteStreamAdd) {
        this.onRemoteStreamAdd(remoteUserId, remoteStream);
      }
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed' || peer.iceConnectionState === 'closed') {
        this.removePeer(remoteUserId);
      }
    };

    if (createOffer) {
      try {
        const offer = await peer.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await peer.setLocalDescription(offer);
        if (this.currentChannelId) {
          socketService.sendOffer(remoteUserId, this.currentChannelId, offer);
        }
      } catch (err) {
        console.error('[WebRTC] Error creating offer for peer:', remoteUserId, err);
      }
    }

    return peer;
  }

  public async handleOffer(remoteUserId: string, channelId: string, offer: RTCSessionDescriptionInit) {
    let peer = this.peers.get(remoteUserId);
    if (!peer) {
      peer = await this.connectToPeer(remoteUserId, false);
    }

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued candidates
      const queued = this.pendingCandidates.get(remoteUserId) || [];
      for (const cand of queued) {
        await peer.addIceCandidate(new RTCIceCandidate(cand));
      }
      this.pendingCandidates.delete(remoteUserId);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socketService.sendAnswer(remoteUserId, channelId, answer);
    } catch (err) {
      console.error('[WebRTC] Error handling offer from peer:', remoteUserId, err);
    }
  }

  public async handleAnswer(remoteUserId: string, answer: RTCSessionDescriptionInit) {
    const peer = this.peers.get(remoteUserId);
    if (!peer) return;

    try {
      await peer.setRemoteDescription(new RTCSessionDescription(answer));

      const queued = this.pendingCandidates.get(remoteUserId) || [];
      for (const cand of queued) {
        await peer.addIceCandidate(new RTCIceCandidate(cand));
      }
      this.pendingCandidates.delete(remoteUserId);
    } catch (err) {
      console.error('[WebRTC] Error handling answer from peer:', remoteUserId, err);
    }
  }

  public async handleIceCandidate(remoteUserId: string, candidate: RTCIceCandidateInit) {
    const peer = this.peers.get(remoteUserId);
    if (peer && peer.remoteDescription && peer.remoteDescription.type) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[WebRTC] Error adding ICE candidate:', err);
      }
    } else {
      if (!this.pendingCandidates.has(remoteUserId)) {
        this.pendingCandidates.set(remoteUserId, []);
      }
      this.pendingCandidates.get(remoteUserId)!.push(candidate);
    }
  }

  private updateVideoTrackOnPeers(newVideoTrack: MediaStreamTrack | null) {
    this.peers.forEach(async (peer, remoteUserId) => {
      const senders = peer.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');

      if (videoSender) {
        if (newVideoTrack) {
          videoSender.replaceTrack(newVideoTrack);
        } else {
          peer.removeTrack(videoSender);
          this.renegotiatePeer(remoteUserId, peer);
        }
      } else if (newVideoTrack) {
        const stream = this.isScreenSharing ? this.localScreenStream! : this.localVideoStream!;
        peer.addTrack(newVideoTrack, stream);
        this.renegotiatePeer(remoteUserId, peer);
      }
    });
  }

  private async renegotiatePeer(remoteUserId: string, peer: RTCPeerConnection) {
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (this.currentChannelId) {
        socketService.sendOffer(remoteUserId, this.currentChannelId, offer);
      }
    } catch (err) {
      console.error('[WebRTC] Error renegotiating with peer:', remoteUserId, err);
    }
  }

  public removePeer(remoteUserId: string) {
    const peer = this.peers.get(remoteUserId);
    if (peer) {
      peer.close();
      this.peers.delete(remoteUserId);
      this.pendingCandidates.delete(remoteUserId);
      if (this.onRemoteStreamRemove) {
        this.onRemoteStreamRemove(remoteUserId);
      }
    }
  }

  public leaveSession() {
    if (this.currentChannelId) {
      socketService.leaveVoice(this.currentChannelId);
    }

    // Stop and close all peer connections
    this.peers.forEach(peer => peer.close());
    this.peers.clear();
    this.pendingCandidates.clear();

    // Stop local tracks
    if (this.localAudioStream) {
      this.localAudioStream.getTracks().forEach(t => t.stop());
      this.localAudioStream = null;
    }
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach(t => t.stop());
      this.localVideoStream = null;
    }
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(t => t.stop());
      this.localScreenStream = null;
    }

    // Clean audio analysis
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isCameraOn = false;
    this.isScreenSharing = false;
    this.isMuted = false;
    this.isDeafened = false;
    this.isLocallySpeaking = false;
    this.currentChannelId = null;
    this.currentUserId = null;
  }

  // --- Web Audio Voice Activity Detection ---
  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.audioSource = this.audioContext.createMediaStreamSource(stream);
      this.audioSource.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speakingThreshold = 18; // RMS sensitivity
      let debounceCount = 0;

      const checkVolume = () => {
        if (!this.analyser || this.isMuted || this.isDeafened) {
          if (this.isLocallySpeaking) {
            this.isLocallySpeaking = false;
            this.onSpeakingChange?.(false);
            if (this.currentChannelId) socketService.emitSpeaking(this.currentChannelId, false);
          }
          this.animFrameId = requestAnimationFrame(checkVolume);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const isSpeakingNow = average > speakingThreshold;

        if (isSpeakingNow) {
          debounceCount = 8; // hold active for a few frames
          if (!this.isLocallySpeaking) {
            this.isLocallySpeaking = true;
            this.onSpeakingChange?.(true);
            if (this.currentChannelId) socketService.emitSpeaking(this.currentChannelId, true);
          }
        } else if (debounceCount > 0) {
          debounceCount--;
        } else if (this.isLocallySpeaking) {
          this.isLocallySpeaking = false;
          this.onSpeakingChange?.(false);
          if (this.currentChannelId) socketService.emitSpeaking(this.currentChannelId, false);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('[WebRTC] Voice activity analyser initialization failed:', err);
    }
  }

  // Getters
  public getLocalAudioStream() { return this.localAudioStream; }
  public getLocalVideoStream() { return this.localVideoStream; }
  public getLocalScreenStream() { return this.localScreenStream; }
  public getIsMuted() { return this.isMuted; }
  public getIsDeafened() { return this.isDeafened; }
  public getIsCameraOn() { return this.isCameraOn; }
  public getIsScreenSharing() { return this.isScreenSharing; }
}

export const webrtcManager = new WebRTCManager();
