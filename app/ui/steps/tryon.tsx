"use client"

import { fal } from "@fal-ai/client"
import { useEffect, useMemo, useRef, useState } from "react"
import { approvedOf, currentOf } from "@/lib/steps"
import type { AssetKind, AssetView } from "@/lib/workspace-types"
import { Icon } from "../kit"
import { StepHead, useWs } from "../workspace"

const MODEL = "decart/lucy2-vton/realtime"

type LiveConn = { send: (input: Record<string, unknown>) => void; close: () => void }

/** Packshot first: Lucy wants the garment alone, on a plain background, not on a person. */
const KINDS: AssetKind[] = ["ghost-front", "ghost-back", "ghost-side", "sketch", "archive"]

const KIND_LABEL: Partial<Record<AssetKind, string>> = {
  "ghost-front": "Packshot fronte",
  "ghost-back": "Packshot retro",
  "ghost-side": "Packshot tre quarti",
  sketch: "Flat tecnico",
  archive: "Archivio",
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error("lettura immagine fallita"))
    reader.readAsDataURL(blob)
  })
}

function iceServersFrom(result: Record<string, unknown>) {
  const raw = (result.iceservers || result.iceServers || result.ice_servers || []) as Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
  return raw.map((s) => ({ urls: s.urls, username: s.username, credential: s.credential }))
}

export function TryonStep() {
  const { ws } = useWs()
  const g = ws.garment
  const options = useMemo(() => {
    const seen = new Set<string>()
    const out: AssetView[] = []
    for (const kind of KINDS) {
      const asset = kind === "ghost-front" ? approvedOf(ws, kind) ?? currentOf(ws.assets, kind) : currentOf(ws.assets, kind)
      if (asset && !seen.has(asset.id)) {
        seen.add(asset.id)
        out.push(asset)
      }
    }
    return out
  }, [ws])

  const [refId, setRefId] = useState(options[0]?.id ?? "")
  const [prompt, setPrompt] = useState(
    `Substitute the clothes the person is wearing with ${g.name}, matching the color, material and fit of the reference image`,
  )
  const [status, setStatus] = useState("Pronto")
  const [live, setLive] = useState(false)
  const [log, setLog] = useState("")
  const [busy, setBusy] = useState(false)
  const [on, setOn] = useState(false)
  const [recording, setRecording] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cameraRef = useRef<HTMLVideoElement>(null)
  const outputRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const connRef = useRef<LiveConn | null>(null)
  const promptRef = useRef(prompt)
  const refIdRef = useRef(refId)
  promptRef.current = prompt
  refIdRef.current = refId

  function note(line: string) {
    const ts = new Date().toLocaleTimeString("it-IT", { hour12: false })
    setLog((prev) => `[${ts}] ${line}\n${prev}`.slice(0, 4000))
  }

  function saveRecording(blob: Blob, mime: string) {
    if (blob.size < 1000) return
    const ext = mime.includes("mp4") ? "mp4" : "webm"
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `prova-${g.sku}-${stamp}.${ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 15_000)
    note("registrazione scaricata")
  }

  function beginRecording(stream: MediaStream) {
    if (recRef.current) return
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined)
    chunksRef.current = []
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" })
      chunksRef.current = []
      saveRecording(blob, rec.mimeType || "video/webm")
    }
    rec.start(1000)
    recRef.current = rec
    setRecording(true)
    note("registrazione avviata")
  }

  function endSession() {
    const rec = recRef.current
    recRef.current = null
    setRecording(false)
    if (rec && rec.state !== "inactive") rec.stop()
    connRef.current?.close()
    connRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (outputRef.current) outputRef.current.srcObject = null
    setLive(false)
    setOn(false)
    setBusy(false)
    setStatus("Pronto")
  }

  useEffect(() => {
    let cancelled = false
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop()
          return
        }
        streamRef.current = stream
        if (cameraRef.current) {
          cameraRef.current.srcObject = stream
          cameraRef.current.play().catch(() => {})
        }
      })
      .catch((err) => note(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
      recRef.current?.stop()
      recRef.current = null
      connRef.current?.close()
      pcRef.current?.close()
      for (const t of streamRef.current?.getTracks() ?? []) t.stop()
      streamRef.current = null
    }
  }, [])

  async function referenceUrl() {
    const asset = options.find((a) => a.id === refIdRef.current) ?? options[0]
    if (!asset) throw new Error("nessuna immagine del capo")
    const res = await fetch(asset.src)
    if (!res.ok) throw new Error(`immagine ${res.status}`)
    return blobToDataUrl(await res.blob())
  }

  async function setupWebRtc(result: Record<string, unknown>) {
    const stream = streamRef.current
    if (!stream) throw new Error("webcam non pronta")
    pcRef.current?.close()
    const pc = new RTCPeerConnection({ iceServers: iceServersFrom(result) })
    pcRef.current = pc
    for (const track of stream.getTracks()) pc.addTrack(track, stream)
    pc.ontrack = (e) => {
      if (outputRef.current) {
        outputRef.current.srcObject = e.streams[0]
        outputRef.current.play().catch(() => {})
      }
      note("stream in arrivo")
      beginRecording(e.streams[0])
      setLive(true)
      setStatus("Live")
    }
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        connRef.current?.send({
          type: "icecandidate",
          candidate: {
            candidate: e.candidate.candidate,
            sdpMid: e.candidate.sdpMid,
            sdpMLineIndex: e.candidate.sdpMLineIndex,
          },
        })
      }
    }
    pc.onconnectionstatechange = () => {
      note(`WebRTC: ${pc.connectionState}`)
      if (pc.connectionState === "failed") setStatus("WebRTC fallito")
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    connRef.current?.send({ type: "offer", sdp: offer.sdp })
    note("offer inviata")
  }

  async function onResult(result: Record<string, unknown>) {
    switch (result.type) {
      case "iceservers":
      case "iceServers":
        await setupWebRtc(result)
        break
      case "answer":
        await pcRef.current?.setRemoteDescription({ type: "answer", sdp: String(result.sdp) })
        note("answer applicata")
        break
      case "icecandidate":
        if (result.candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(result.candidate as RTCIceCandidateInit))
        }
        break
      case "ice-restart": {
        const turn = result.turn_config as { server_url: string; username: string; credential: string } | undefined
        const pc = pcRef.current
        if (turn && pc) {
          pc.setConfiguration({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: turn.server_url, username: turn.username, credential: turn.credential },
            ],
          })
          const offer = await pc.createOffer({ iceRestart: true })
          await pc.setLocalDescription(offer)
          connRef.current?.send({ type: "offer", sdp: offer.sdp })
          note("ICE restart")
        }
        break
      }
      case "prompt_ack":
        note(result.success ? "prompt accettato" : `prompt rifiutato: ${result.error ?? "?"}`)
        break
      case "set_image_ack":
        note(result.success ? "riferimento aggiornato" : `immagine rifiutata: ${result.error ?? "?"}`)
        break
      case "generation_started":
        note("generazione avviata")
        setLive(true)
        setStatus("Live")
        break
      case "error":
        note(`errore: ${result.error ?? "?"}`)
        setStatus("Errore")
        break
      default:
        if (result.type) note(String(result.type))
    }
  }

  async function start() {
    if (connRef.current) return
    setBusy(true)
    setStatus("Connessione…")
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cameraRef.current) {
          cameraRef.current.srcObject = streamRef.current
          await cameraRef.current.play().catch(() => {})
        }
      }
      const reference = await referenceUrl()
      const connection = fal.realtime.connect(MODEL, {
        connectionKey: crypto.randomUUID(),
        throttleInterval: 0,
        tokenProvider: async (app) => {
          const res = await fetch(`/api/fal/token?app=${encodeURIComponent(app)}`)
          if (!res.ok) throw new Error(await res.text())
          const token = await res.json()
          if (typeof token !== "string") throw new Error("token non valido")
          return token
        },
        tokenExpirationSeconds: 120,
        onResult: (result) => {
          onResult(result as Record<string, unknown>).catch((err) => {
            note(err instanceof Error ? err.message : String(err))
            setStatus("Errore")
          })
        },
        onError: (error) => {
          note(error.message ?? String(error))
          setStatus("Errore")
        },
      })
      connRef.current = connection as unknown as LiveConn
      setOn(true)
      connRef.current?.send({
        prompt: promptRef.current.trim(),
        reference_image_url: reference,
        enhance_prompt: true,
      })
      note("prompt inviato, attendo ICE…")
      setStatus("In attesa del modello…")
    } catch (err) {
      note(err instanceof Error ? err.message : String(err))
      setStatus("Errore")
      endSession()
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (on) apply().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refId])

  async function apply() {
    if (!connRef.current) return
    const reference = await referenceUrl()
    connRef.current.send({
      prompt: promptRef.current.trim(),
      reference_image_url: reference,
      enhance_prompt: true,
    })
    note("look aggiornato")
  }

  return (
    <>
      <StepHead />
      <div className="tryon">
        <div className="tryon-stage" ref={stageRef}>
          <video ref={outputRef} playsInline autoPlay muted className="tryon-main" hidden={!live} />
          <video ref={cameraRef} playsInline autoPlay muted className={live ? "tryon-pip tryon-mirror" : "tryon-main tryon-mirror"} />
          <div className="tryon-hud">
            <span>{recording ? "Rec" : live ? "Live" : status}</span>
          </div>
          <button className="icon-btn tryon-full" type="button" onClick={() => stageRef.current?.requestFullscreen()} aria-label="Schermo intero">
            <Icon name="arrow" size={13} />
          </button>
        </div>
        <div className="tryon-bar">
          {on ? (
            <button className="btn secondary" onClick={endSession}>
              Ferma
            </button>
          ) : (
            <button className="btn primary lg" onClick={start} disabled={busy || !options.length}>
              {busy ? <span className="spinner" /> : null} Avvia la prova
            </button>
          )}
          {options.length > 1 && (
            <select className="tryon-ref" value={refId} onChange={(e) => setRefId(e.target.value)} aria-label="Riferimento">
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {KIND_LABEL[a.kind] ?? a.label ?? a.kind}
                </option>
              ))}
            </select>
          )}
        </div>
        <details className="advanced">
          <summary>Avanzate</summary>
          <label className="tryon-prompt">
            <span className="caps">Prompt</span>
            <input className="field-input" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
        </details>
      </div>
    </>
  )
}
