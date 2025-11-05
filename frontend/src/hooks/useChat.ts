import { useState, useCallback, useEffect, useRef } from 'react';
import socketService from '../services/socket.service';
import { Message } from '../types';

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Message received
    socket.on('receive_message', (data: { message: string; timestamp: Date }) => {
      setMessages((prev) => [
        ...prev,
        {
          text: data.message,
          sender: 'stranger',
          timestamp: new Date(data.timestamp),
        },
      ]);
    });

    // Typing indicators
    socket.on('typing_start', () => {
      setIsTyping(true);
    });

    socket.on('typing_stop', () => {
      setIsTyping(false);
    });

    // Partner disconnected
    socket.on('partner_disconnected', (data: { reason: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          text: `Stranger has disconnected. ${data.reason}`,
          sender: 'stranger',
          timestamp: new Date(),
        },
      ]);
    });

    return () => {
      socket.off('receive_message');
      socket.off('typing_start');
      socket.off('typing_stop');
      socket.off('partner_disconnected');
    };
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;

    socketService.sendMessage(text);
    setMessages((prev) => [
      ...prev,
      {
        text,
        sender: 'me',
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleTyping = useCallback(() => {
    socketService.sendTypingStart();

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      socketService.sendTypingStop();
    }, 1000);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsTyping(false);
  }, []);

  const addSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      {
        text,
        sender: 'stranger',
        timestamp: new Date(),
      },
    ]);
  }, []);

  return {
    messages,
    isTyping,
    sendMessage,
    handleTyping,
    clearMessages,
    addSystemMessage,
  };
};
