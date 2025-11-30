"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import styles from "./page.module.css"

export default function SommailerPage() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/sommailer" }),
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || status === "in_progress") return

    sendMessage({ text: inputValue })
    setInputValue("")
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Tilbake
        </button>
        <div className={styles.headerContent}>
          <div className={styles.icon}>🍷</div>
          <div>
            <h1 className={styles.title}>Sommailer</h1>
            <p className={styles.subtitle}>Din personlige vin-assistent</p>
          </div>
        </div>
      </div>

      <div className={styles.chatContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <h2>Velkommen til Sommailer!</h2>
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

        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.message} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
          >
            <div className={styles.messageContent}>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <div key={index} className={styles.messageText}>
                      {part.text}
                    </div>
                  )
                }
                return null
              })}
            </div>
          </div>
        ))}

        {status === "in_progress" && (
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

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Still et spørsmål om vin..."
          className={styles.input}
          disabled={status === "in_progress"}
        />
        <button type="submit" className={styles.sendButton} disabled={status === "in_progress" || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  )
}
