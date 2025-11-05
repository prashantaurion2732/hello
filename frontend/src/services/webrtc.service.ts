import SimplePeer from 'simple-peer';

interface WebRTCConfig {
  iceServers: RTCIceServer[];
  initiator: boolean;
  stream?: MediaStream;
}

class WebRTCService {
  private peer: SimplePeer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  async getLocalStream(audio: boolean = true, video: boolean = true): Promise<MediaStream> {
    try {
      if (this.localStream) {
        return this.localStream;
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });

      return this.localStream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      throw new Error('Failed to access camera/microphone. Please grant permissions.');
    }
  }

  createPeer(config: WebRTCConfig): SimplePeer.Instance {
    if (this.peer) {
      this.peer.destroy();
    }

    this.peer = new SimplePeer({
      initiator: config.initiator,
      trickle: true,
      stream: config.stream,
      config: {
        iceServers: config.iceServers,
      },
    });

    return this.peer;
  }

  getPeer(): SimplePeer.Instance | null {
    return this.peer;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  setRemoteStream(stream: MediaStream): void {
    this.remoteStream = stream;
  }

  stopLocalStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  stopRemoteStream(): void {
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach(track => track.stop());
      this.remoteStream = null;
    }
  }

  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  isAudioEnabled(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    return audioTrack?.enabled || false;
  }

  isVideoEnabled(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    return videoTrack?.enabled || false;
  }

  destroy(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.stopLocalStream();
    this.stopRemoteStream();
  }
}

export default new WebRTCService();
