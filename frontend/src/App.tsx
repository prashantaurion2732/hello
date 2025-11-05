import { useEffect, useState } from 'react';
import { ConnectionState, MatchData } from './types';
import { useSocket } from './hooks/useSocket';
import { useChat } from './hooks/useChat';
import { useWebRTC } from './hooks/useWebRTC';
import { VideoDisplay } from './components/VideoDisplay';
import { ChatBox } from './components/ChatBox';
import { InterestSelector } from './components/InterestSelector';
import { Controls } from './components/Controls';
import socketService from './services/socket.service';

function App() {
  const {
    connectionState,
    setConnectionState,
    userId,
    error,
    setError,
    iceServers,
    startSearch,
    stopSearch,
    skipPartner,
    endChat,
  } = useSocket();

  const { messages, isTyping, sendMessage, handleTyping, clearMessages, addSystemMessage } =
    useChat();

  const {
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    createPeerConnection,
    toggleAudio,
    toggleVideo,
    cleanup: cleanupWebRTC,
  } = useWebRTC(iceServers);

  const [matchData, setMatchData] = useState<MatchData | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Match found
    socket.on('match_found', async (data: MatchData) => {
      console.log('Match found:', data);
      setMatchData(data);
      setConnectionState(ConnectionState.MATCHED);
      addSystemMessage('Connected with a stranger!');

      // Initiate WebRTC connection (first user becomes initiator)
      try {
        await createPeerConnection(true);
      } catch (error) {
        console.error('Failed to create peer connection:', error);
        setError('Failed to establish video connection');
      }
    });

    // Match failed
    socket.on('match_failed', () => {
      addSystemMessage('No match found. Please try again.');
      setConnectionState(ConnectionState.CONNECTED);
    });

    // Partner disconnected
    socket.on('partner_disconnected', (data: { reason: string }) => {
      addSystemMessage(`Stranger disconnected: ${data.reason}`);
      handleStopChat();
    });

    // Report submitted
    socket.on('report_submitted', () => {
      addSystemMessage('Report submitted. Thank you for helping keep our community safe.');
    });

    return () => {
      socket.off('match_found');
      socket.off('match_failed');
      socket.off('partner_disconnected');
      socket.off('report_submitted');
    };
  }, [iceServers, createPeerConnection, setConnectionState, addSystemMessage, setError]);

  const handleStartSearch = (interests: string[]) => {
    clearMessages();
    startSearch(interests);
  };

  const handleSkip = () => {
    skipPartner();
    cleanupWebRTC();
    clearMessages();
    setMatchData(null);
    setConnectionState(ConnectionState.SEARCHING);
  };

  const handleStopChat = () => {
    endChat();
    cleanupWebRTC();
    clearMessages();
    setMatchData(null);
    setConnectionState(ConnectionState.CONNECTED);
  };

  const handleReport = () => {
    const reason = prompt('Please describe the reason for reporting this user:');
    if (reason && reason.trim().length >= 5) {
      socketService.reportUser(reason);
    }
  };

  const renderContent = () => {
    switch (connectionState) {
      case ConnectionState.DISCONNECTED:
      case ConnectionState.CONNECTING:
        return (
          <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4" />
              <p className="text-gray-600">Connecting to server...</p>
            </div>
          </div>
        );

      case ConnectionState.ERROR:
        return (
          <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="text-center max-w-md">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Connection Error</h2>
              <p className="text-gray-600 mb-4">{error || 'Failed to connect to server'}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                Retry
              </button>
            </div>
          </div>
        );

      case ConnectionState.CONNECTED:
        return (
          <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">Omegle Clone</h1>
                <p className="text-gray-600">Talk to strangers from around the world!</p>
              </div>
              <InterestSelector onStartSearch={handleStartSearch} />
            </div>
          </div>
        );

      case ConnectionState.SEARCHING:
        return (
          <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4" />
              <p className="text-gray-600 text-xl mb-2">Searching for a stranger...</p>
              <button
                onClick={() => {
                  stopSearch();
                  setConnectionState(ConnectionState.CONNECTED);
                }}
                className="mt-4 px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        );

      case ConnectionState.MATCHED:
      case ConnectionState.IN_CHAT:
        return (
          <div className="h-screen bg-gray-100 flex flex-col p-4">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-lg px-6 py-3 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Omegle Clone</h1>
                  <p className="text-sm text-gray-500">
                    Connected with stranger
                    {matchData?.partnerInterests.length ? (
                      <span className="ml-2">
                        ({matchData.partnerInterests.join(', ')})
                      </span>
                    ) : null}
                  </p>
                </div>
                {error && (
                  <div className="text-red-500 text-sm">
                    <span>⚠️ {error}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex gap-4 overflow-hidden">
              {/* Video section */}
              <div className="flex-1 flex flex-col gap-4">
                {/* Remote video (larger) */}
                <div className="flex-1">
                  <VideoDisplay stream={remoteStream} label="Stranger" muted={false} />
                </div>

                {/* Local video (smaller) */}
                <div className="h-48">
                  <VideoDisplay stream={localStream} label="You" muted={true} mirrored={true} />
                </div>
              </div>

              {/* Chat section */}
              <div className="w-96 flex flex-col gap-4">
                <div className="flex-1">
                  <ChatBox
                    messages={messages}
                    isTyping={isTyping}
                    onSendMessage={sendMessage}
                    onTyping={handleTyping}
                    disabled={false}
                  />
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-4">
              <Controls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onSkip={handleSkip}
                onStop={handleStopChat}
                onReport={handleReport}
                disabled={false}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return <div className="App">{renderContent()}</div>;
}

export default App;
