'use client';
import type React from 'react';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

export default function SommailerPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/sommailer' })
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    console.log('[v0] Input value:', input, 'Length:', input.length);
    console.log('[v0] Status:', status, 'isLoading:', isLoading);
  }, [input, status, isLoading]);

  useEffect(() => {
    console.log('[v0] Messages:', messages);
    if (error) {
      console.error('[v0] Chat error:', error);
    }
  }, [messages, error]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.icon}>🍷</div>
          <div>
            <h1 className={styles.title}>SommelAier</h1>
            <p className={styles.subtitle}>Din personlige vin-assistent</p>
          </div>
        </div>
      </div>

      <div className={styles.chatContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <h2>Velkommen til SommelAier!</h2>
            <p>Jeg kan hjelpe deg med:</p>
            <ul>
              <li>Vinparing til mat</li>
              <li>Informasjon om druesorter og vinregioner</li>
              <li>Forslag til viner basert på smak</li>
              <li>Lagring og servering av vin</li>
              <li>Generelle spørsmål om vin</li>
            </ul>
            <p className={styles.prompt}>Still meg et spørsmål for å komme i gang!</p>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>Det oppstod en feil: {error.message}</p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}>
            <div className={styles.messageContent}>
              {typeof message.content === 'string' ? (
                message.role === 'assistant' ? (
                  <div className={styles.messageText}>
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className={styles.messageText}>{message.content}</div>
                )
              ) : (
                message.parts?.map((part, index) => {
                  if (part.type === 'text') {
                    return message.role === 'assistant' ? (
                      <div
                        key={index}
                        className={styles.messageText}>
                        <ReactMarkdown>{part.text}</ReactMarkdown>
                      </div>
                    ) : (
                      <div
                        key={index}
                        className={styles.messageText}>
                        {part.text}
                      </div>
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.messageContent}>
              <div className={styles.typing}>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputForm}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Still et spørsmål om vin..."
          className={styles.input}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={handleSend}
          className={styles.sendButton}
          disabled={isLoading || input.length === 0}>
          Send
        </button>
      </div>
    </div>
  );
}
