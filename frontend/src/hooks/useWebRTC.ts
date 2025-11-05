import { useState, useCallback, useEffect, useRef } from 'react';
import SimplePeer from 'simple-peer';
import socketService from '../services/socket.service';
import webrtcService from '../services/webrtc.service';

export const useWebRTC = (iceServers: RTCIceServer[]) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isInitiator, setIsInitiator] = useState(false);
  const peerRef = useRef<SimplePeer.Instance | null>(null);

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await webrtcService.getLocalStream(true, true);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to initialize media:', error);
      throw error;
    }
  }, []);

  const createPeerConnection = useCallback(
    async (initiator: boolean) => {
      try {
        setIsInitiator(initiator);
        const stream = await initializeMedia();

        const peer = webrtcService.createPeer({
          initiator,
          iceServers,
          stream,
        });

        peerRef.current = peer;

        // Handle signaling
        peer.on('signal', (data: any) => {
          if (data.type === 'offer') {
            socketService.sendWebRTCOffer(data);
          } else if (data.type === 'answer') {
            socketService.sendWebRTCAnswer(data);
          }
        });

        // Handle remote stream
        peer.on('stream', (stream: MediaStream) => {
          console.log('Received remote stream');
          setRemoteStream(stream);
          webrtcService.setRemoteStream(stream);
        });

        // Handle errors
        peer.on('error', (err: Error) => {
          console.error('Peer error:', err);
        });

        // Handle connection events
        peer.on('connect', () => {
          console.log('Peer connected');
        });

        peer.on('close', () => {
          console.log('Peer connection closed');
          cleanup();
        });

        return peer;
      } catch (error) {
        console.error('Failed to create peer connection:', error);
        throw error;
      }
    },
    [iceServers, initializeMedia]
  );

  const handleWebRTCOffer = useCallback(
    async (data: { offer: RTCSessionDescriptionInit }) => {
      try {
        const peer = await createPeerConnection(false);
        peer.signal(data.offer);
      } catch (error) {
        console.error('Failed to handle WebRTC offer:', error);
      }
    },
    [createPeerConnection]
  );

  const handleWebRTCAnswer = useCallback((data: { answer: RTCSessionDescriptionInit }) => {
    try {
      if (peerRef.current) {
        peerRef.current.signal(data.answer);
      }
    } catch (error) {
      console.error('Failed to handle WebRTC answer:', error);
    }
  }, []);

  const handleWebRTCIceCandidate = useCallback(
    (data: { candidate: RTCIceCandidateInit }) => {
      try {
        if (peerRef.current) {
          peerRef.current.signal(data.candidate);
        }
      } catch (error) {
        console.error('Failed to handle ICE candidate:', error);
      }
    },
    []
  );

  const toggleAudio = useCallback(() => {
    const newState = !isAudioEnabled;
    webrtcService.toggleAudio(newState);
    setIsAudioEnabled(newState);
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    const newState = !isVideoEnabled;
    webrtcService.toggleVideo(newState);
    setIsVideoEnabled(newState);
  }, [isVideoEnabled]);

  const cleanup = useCallback(() => {
    webrtcService.destroy();
    setLocalStream(null);
    setRemoteStream(null);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    peerRef.current = null;
  }, []);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('webrtc_offer', handleWebRTCOffer);
    socket.on('webrtc_answer', handleWebRTCAnswer);
    socket.on('webrtc_ice_candidate', handleWebRTCIceCandidate);

    return () => {
      socket.off('webrtc_offer', handleWebRTCOffer);
      socket.off('webrtc_answer', handleWebRTCAnswer);
      socket.off('webrtc_ice_candidate', handleWebRTCIceCandidate);
      cleanup();
    };
  }, [handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIceCandidate, cleanup]);

  return {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    createPeerConnection,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
};
