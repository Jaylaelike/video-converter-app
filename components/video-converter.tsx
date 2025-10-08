"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, FileAudio, Download, X } from "lucide-react"
import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"

export default function VideoConverter() {
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [convertedAudio, setConvertedAudio] = useState<string | null>(null)
  const [audioSize, setAudioSize] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current

    const ffmpeg = new FFmpeg()

    ffmpeg.on("log", ({ message }) => {
      console.log("[v0]", message)
    })

    ffmpeg.on("progress", ({ progress: prog }) => {
      setProgress(Math.round(prog * 100))
    })

    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd"
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })

    ffmpegRef.current = ffmpeg
    return ffmpeg
  }

  const handleFileChange = (selectedFile: File) => {
    if (!selectedFile.type.startsWith("video/")) {
      setError("Please select a valid video file")
      return
    }
    setFile(selectedFile)
    setConvertedAudio(null)
    setError(null)
    setProgress(0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange(droppedFile)
    }
  }

  const convertToAudio = async () => {
    if (!file) return

    setIsConverting(true)
    setError(null)
    setProgress(0)

    try {
      const ffmpeg = await loadFFmpeg()

      await ffmpeg.writeFile("input.mp4", await fetchFile(file))

      // Calculate target bitrate to keep file under 200MB
      // Estimate: 200MB = 200 * 1024 * 1024 bytes = 209715200 bytes
      // For safety, target 180MB to account for overhead
      const targetSizeBytes = 180 * 1024 * 1024
      const videoDuration = await getVideoDuration(file)
      const targetBitrate = Math.floor((targetSizeBytes * 8) / videoDuration / 1000) // in kbps

      // Use a reasonable bitrate (between 64kbps and 320kbps)
      const bitrate = Math.min(Math.max(targetBitrate, 64), 320)

      await ffmpeg.exec([
        "-i",
        "input.mp4",
        "-vn",
        "-acodec",
        "libmp3lame",
        "-b:a",
        `${bitrate}k`,
        "-ar",
        "44100",
        "output.mp3",
      ])

      const data = await ffmpeg.readFile("output.mp3")
      const blob = new Blob([data], { type: "audio/mp3" })
      const url = URL.createObjectURL(blob)

      setConvertedAudio(url)
      setAudioSize(blob.size)

      // Clean up
      await ffmpeg.deleteFile("input.mp4")
      await ffmpeg.deleteFile("output.mp3")
    } catch (err) {
      console.error("[v0] Conversion error:", err)
      setError("Failed to convert video. Please try again.")
    } finally {
      setIsConverting(false)
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.src = URL.createObjectURL(file)
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const resetConverter = () => {
    setFile(null)
    setConvertedAudio(null)
    setProgress(0)
    setError(null)
    setAudioSize(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-8">
      {/* Step 1: Upload File */}
      <Card className="p-8 border-4 border-primary bg-card">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2 uppercase tracking-wide font-sans">
              Step 1: Upload File
            </h2>
            <p className="text-foreground leading-relaxed">
              Upload your video file to convert to audio format. Supports MP4, AVI, MOV, and more.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 h-14 border-4 border-primary bg-input text-foreground hover:bg-muted font-bold text-lg"
                disabled={isConverting}
              >
                <Upload className="mr-2 h-5 w-5" />
                Upload file
              </Button>
              <Button
                onClick={convertToAudio}
                disabled={!file || isConverting}
                className="h-14 px-8 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg"
              >
                {isConverting ? "Converting..." : "Convert"}
              </Button>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-4 border-primary bg-input p-8 text-center transition-colors ${
                isDragging ? "bg-muted" : ""
              }`}
            >
              <p className="text-foreground font-bold text-lg">Drag & Drop a file here</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              className="hidden"
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 border-4 border-primary bg-input">
              <div className="flex items-center gap-3">
                <FileAudio className="h-6 w-6 text-foreground" />
                <div>
                  <p className="font-bold text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetConverter}
                disabled={isConverting}
                className="text-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          )}

          {error && (
            <div className="p-4 border-4 border-destructive bg-destructive/10">
              <p className="text-destructive font-bold">{error}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Step 2: Conversion Progress */}
      {isConverting && (
        <Card className="p-8 border-4 border-primary bg-card">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-foreground uppercase tracking-wide font-sans">Step 2: Converting</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-foreground font-bold">Progress</span>
                <span className="text-foreground font-bold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Please wait while we convert your video to audio format...
            </p>
          </div>
        </Card>
      )}

      {/* Step 3: Download */}
      {convertedAudio && (
        <Card className="p-8 border-4 border-primary bg-card">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2 uppercase tracking-wide font-sans">
                Step 3: Download
              </h2>
              <p className="text-foreground leading-relaxed">
                Your audio file is ready! File size: {formatFileSize(audioSize)}
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                asChild
                className="flex-1 h-14 bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg"
              >
                <a href={convertedAudio} download={`${file?.name.replace(/\.[^/.]+$/, "")}.mp3`}>
                  <Download className="mr-2 h-5 w-5" />
                  Download Audio
                </a>
              </Button>
              <Button
                onClick={resetConverter}
                variant="outline"
                className="h-14 px-8 border-4 border-primary bg-input text-foreground hover:bg-muted font-bold text-lg"
              >
                Convert Another
              </Button>
            </div>

            {audioSize > 200 * 1024 * 1024 && (
              <div className="p-4 border-4 border-accent bg-accent/10">
                <p className="text-foreground font-bold">
                  ⚠️ Note: File size exceeds 200MB. Consider using a shorter video or lower quality settings.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
