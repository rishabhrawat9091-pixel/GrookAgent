"use client"

import React, { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Check,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  KeyRound,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"

export type ConnectorId =
  | "gmail"
  | "telegram"

export interface ConnectorField {
  key: string
  label: string
  placeholder: string
  type: "text" | "password" | "select"
  options?: string[]
  helperText?: string
  required?: boolean
}

export interface ConnectorConfig {
  id: ConnectorId
  name: string
  detail: string
  icon: React.ComponentType<{ className?: string }>
  badgeBg: string
  badgeText: string
  docsUrl: string
  docsLabel: string
  fields: ConnectorField[]
}

export const CONNECTORS: ConnectorConfig[] = [
  {
    id: "gmail",
    name: "Google Mail",
    detail: "Send emails directly via Gmail SMTP & App Password",
    icon: Mail,
    badgeBg:
      "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/40",
    badgeText: "Gmail SMTP",
    docsUrl: "https://myaccount.google.com/apppasswords",
    docsLabel: "Google App Passwords",
    fields: [
      {
        key: "userEmail",
        label: "Gmail Address",
        placeholder: "you@gmail.com",
        type: "text",
        helperText:
          "The Gmail address the agent will send emails from",
        required: true,
      },
      {
        key: "appPassword",
        label: "Gmail App Password",
        placeholder: "xxxx xxxx xxxx xxxx",
        type: "password",
        helperText:
          "16-character App Password (Google Account → Security → 2-Step Verification → App Passwords)",
        required: true,
      },
    ],
  },
  {
    id: "telegram",
    name: "Telegram",
    detail: "Search channels and summarize conversation threads",
    icon: MessageSquareText,
    badgeBg:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/40",
    badgeText: "Telegram App",
    docsUrl: "https://api.slack.com/apps",
    docsLabel: "Telegram API Dashboard",
    fields: [
      {
        key: "botToken",
        label: "Bot User OAuth Token",
        placeholder:
          "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxx",
        type: "password",
        helperText:
          "Starts with xoxb-. Found in OAuth & Permissions",
        required: true,
      },
      {
        key: "signingSecret",
        label: "Signing Secret",
        placeholder: "e.g. 8f7a9b1c2d3e4f5a6b7c8d9e",
        type: "password",
        helperText:
          "Used to verify requests incoming from Slack",
        required: true,
      },
      {
        key: "defaultChannel",
        label: "Default Channel Name or ID",
        placeholder: "#customer-support or C0123456789",
        type: "text",
        helperText:
          "Primary channel for alerts and context lookups",
        required: false,
      },
    ],
  },
]

interface ConnectorCredentialModalProps {
  connector: ConnectorConfig | null
  isOpen: boolean
  agentId: string
  initialValues?: Record<string, string>
  onClose: () => void
  onSave?: (
    connectorId: ConnectorId,
    credentials: Record<string, string>
  ) => void
  onDisconnect?: (connectorId: ConnectorId) => void
  isConnected?: boolean
}

export function ConnectorCredentialModal({
  connector,
  isOpen,
  agentId,
  initialValues = {},
  onClose,
  onSave,
  onDisconnect,
  isConnected = false,
}: ConnectorCredentialModalProps) {
  const [formData, setFormData] =
    useState<Record<string, string>>({})
  const [showPassword, setShowPassword] =
    useState<Record<string, boolean>>({})
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    if (isOpen && connector) {
      const frame = requestAnimationFrame(() => {
        setAnimateIn(true)
      })

      return () => cancelAnimationFrame(frame)
    }

    setAnimateIn(false)
  }, [isOpen, connector])

  const handleClose = () => {
    setAnimateIn(false)

    setTimeout(() => {
      onClose()
    }, 180)
  }

  useEffect(() => {
    if (connector) {
      const defaults: Record<string, string> = {
        ...initialValues,
      }

      connector.fields.forEach((field) => {
        if (
          !defaults[field.key] &&
          field.type === "select" &&
          field.options?.[0]
        ) {
          defaults[field.key] = field.options[0]
        }
      })

      setFormData(defaults)
      setStatusMessage(null)
      setShowPassword({})
    }
  }, [connector, isOpen, initialValues])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose()
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown)
    }

    return () =>
      window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  if (!isOpen || !connector) return null

  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return null
  }

  const Icon = connector.icon

  const handleFieldChange = (
    key: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const togglePasswordVisibility = (key: string) => {
    setShowPassword((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleSave = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    if (!agentId) {
      setStatusMessage({
        type: "error",
        text: "Agent ID is required.",
      })
      return
    }

    const missing = connector.fields.filter(
      (field) =>
        field.required &&
        (!formData[field.key] ||
          formData[field.key].trim() === "")
    )

    if (missing.length > 0) {
      setStatusMessage({
        type: "error",
        text: `Please fill in all required fields: ${missing
          .map((field) => field.label)
          .join(", ")}`,
      })
      return
    }

    try {
      setIsSaving(true)
      setStatusMessage(null)

      const response = await fetch("/api/connector", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId,
          connectorType: connector.id,
          credentials: formData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        console.log("failed to save the connector")
        throw new Error(
          result?.error || "Failed to save connector"
        )
      }

      setStatusMessage({
        type: "success",
        text: `${connector.name} connected successfully.`,
      })

      onSave?.(connector.id, formData)

      setTimeout(() => {
        handleClose()
      }, 500)
    } catch (error) {
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save connector.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      setIsSaving(true)

      const response = await fetch(
        `/api/connector?agentId=${encodeURIComponent(
          agentId
        )}&connectorType=${encodeURIComponent(
          connector.id
        )}`,
        {
          method: "DELETE",
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to disconnect connector"
        )
      }

      onDisconnect?.(connector.id)
      handleClose()
    } catch (error) {
      setStatusMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to disconnect connector.",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        opacity: animateIn ? 1 : 0,
        transition:
          "opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connector-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "32rem",
          maxHeight: "100vh",
          overflowY: "auto",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          opacity: animateIn ? 1 : 0,
          transform: animateIn
            ? "scale(1) translateY(0)"
            : "scale(0.95) translateY(10px)",
          transition:
            "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-11 items-center justify-center rounded-xl border ${connector.badgeBg}`}
            >
              <Icon className="size-5" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="connector-modal-title"
                  className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Connect {connector.name}
                </h2>

                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                  {connector.badgeText}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                {connector.detail}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-teal-200/60 bg-teal-50/50 p-3 text-xs text-teal-900 dark:border-teal-900/50 dark:bg-teal-950/20 dark:text-teal-200">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-600 dark:text-teal-400" />

          <div className="flex-1 leading-5">
            <span className="font-semibold">
              Secure Connector:
            </span>{" "}
            Credentials are sent to the server and stored with
            the agent connector configuration.
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="mt-4 space-y-4"
        >
          <div
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            className="max-h-[350px] space-y-3.5 overflow-y-auto pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {connector.fields.map((field) => (
              <div
                key={field.key}
                className="space-y-1.5"
              >
                <label className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>
                    {field.label}{" "}
                    {field.required ? (
                      <span className="text-rose-500">
                        *
                      </span>
                    ) : (
                      <span className="text-[11px] font-normal text-zinc-400">
                        (optional)
                      </span>
                    )}
                  </span>
                </label>

                {field.type === "select" ? (
                  <select
                    value={
                      formData[field.key] ||
                      field.options?.[0] ||
                      ""
                    }
                    onChange={(e) =>
                      handleFieldChange(
                        field.key,
                        e.target.value
                      )
                    }
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {field.options?.map((option) => (
                      <option
                        key={option}
                        value={option}
                      >
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type={
                        field.type === "password"
                          ? showPassword[field.key]
                            ? "text"
                            : "password"
                          : "text"
                      }
                      value={formData[field.key] || ""}
                      onChange={(e) =>
                        handleFieldChange(
                          field.key,
                          e.target.value
                        )
                      }
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    />

                    {field.type === "password" && (
                      <button
                        type="button"
                        onClick={() =>
                          togglePasswordVisibility(
                            field.key
                          )
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        {showPassword[field.key] ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}

                {field.helperText && (
                  <p className="text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                    {field.helperText}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <KeyRound className="size-3.5 text-zinc-400" />
              Need credentials?
            </span>

            <a
              href={connector.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              Get from {connector.docsLabel}
              <ExternalLink className="size-3" />
            </a>
          </div>

          {statusMessage && (
            <div
              className={`rounded-lg p-2.5 text-xs font-medium ${statusMessage.type === "success"
                ? "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300"
                : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                }`}
            >
              {statusMessage.text}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition"
              >
                <Trash2 className="size-3.5" />
                Disconnect
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Save & Connect
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}