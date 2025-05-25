"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Download, Music, Video, Zap, Shield, Smartphone, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import Link from "next/link"

interface ConversionHistory {
  id: string
  url: string
  format: "MP3" | "MP4"
  quality: string
  title: string
  timestamp: Date
  downloadUrl: string
  filename: string
}

interface ConversionState {
  isConverting: boolean
  progress: number
  downloadUrl: string | null
  convertedTitle: string | null
}

// Quality block component
interface QualityBlockProps {
  value: string
  label: string
  isSelected: boolean
  onClick: () => void
  format: "MP3" | "MP4"
}

function QualityBlock({ value, label, isSelected, onClick, format }: QualityBlockProps) {
  return (
    <div 
      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-blue-400 hover:bg-blue-50 ${
        isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">
            {format === "MP3" ? "Audio quality" : "Video resolution"}
          </p>
        </div>
        {isSelected && (
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

// Add a client-side only component for date formatting
function FormattedDate({ date }: { date: Date }) {
  const [formattedDate, setFormattedDate] = useState<string>("");
  
  useEffect(() => {
    // Format date only on the client side
    setFormattedDate(date.toLocaleDateString());
  }, [date]);
  
  return <span className="text-xs text-gray-500">{formattedDate}</span>;
}

export default function YouTubeConverter() {
  const [url, setUrl] = useState("")
  const [format, setFormat] = useState<"MP3" | "MP4">("MP3")
  const [quality, setQuality] = useState("")
  const [conversion, setConversion] = useState<ConversionState>({
    isConverting: false,
    progress: 0,
    downloadUrl: null,
    convertedTitle: null,
  })
  const [history, setHistory] = useState<ConversionHistory[]>([])
  const [urlError, setUrlError] = useState("")

  const { toast } = useToast()

  // Load conversion history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem("conversionHistory")
    if (savedHistory) {
      try {
        // Parse the saved history and convert timestamp strings to Date objects
        const parsedHistory = JSON.parse(savedHistory).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setHistory(parsedHistory)
      } catch (error) {
        console.error("Error parsing conversion history:", error);
        setHistory([]);
      }
    }
  }, [])

  // Save history to localStorage
  const saveHistory = (newHistory: ConversionHistory[]) => {
    localStorage.setItem("conversionHistory", JSON.stringify(newHistory))
    setHistory(newHistory)
  }

  // YouTube URL validation
  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)[\w-]+/
    return youtubeRegex.test(url)
  }

  // Handle URL input change
  const handleUrlChange = (value: string) => {
    setUrl(value)
    if (value && !validateYouTubeUrl(value)) {
      setUrlError("Please enter a valid YouTube URL")
    } else {
      setUrlError("")
    }
    // Reset conversion state when URL changes
    setConversion({
      isConverting: false,
      progress: 0,
      downloadUrl: null,
      convertedTitle: null,
    })
  }

  // Handle format change
  const handleFormatChange = (newFormat: "MP3" | "MP4") => {
    setFormat(newFormat)
    setQuality("") // Reset quality when format changes
  }

  // Get quality options based on format
  const getQualityOptions = () => {
    if (format === "MP3") {
      return [
        { value: "128", label: "128 kbps" },
        { value: "192", label: "192 kbps" },
        { value: "320", label: "320 kbps" },
      ]
    } else {
      return [
        { value: "480", label: "480p" },
        { value: "720", label: "720p (HD)" },
        { value: "1080", label: "1080p (FHD)" },
      ]
    }
  }

  // Handle conversion
  const handleConvert = async () => {
    if (!url || !validateYouTubeUrl(url)) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid YouTube URL",
        variant: "destructive",
      })
      return
    }

    if (!quality) {
      toast({
        title: "Select Quality",
        description: "Please select a quality option",
        variant: "destructive",
      })
      return
    }

    setConversion({
      isConverting: true,
      progress: 0,
      downloadUrl: null,
      convertedTitle: null,
    })

    try {
      console.log(`Starting conversion: URL=${url}, Format=${format}, Quality=${quality}`);
      
      // Call backend API
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, format: format.toLowerCase(), quality }),
      })

      if (!response.ok) {
        // Try to get detailed error message from response
        let errorMessage = "Conversion failed. Please try again.";
        try {
          const errorData = await response.json();
          console.error("API error response:", errorData);
          errorMessage = errorData.details || errorData.error || errorMessage;
        } catch (e) {
          console.error("Failed to parse error response:", e);
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error("No response body received from server");
      }

      // Get filename from headers
      const disposition = response.headers.get("Content-Disposition")
      let fileName = `youtube-download.${format.toLowerCase()}`
      if (disposition) {
        const match = disposition.match(/filename="(.+?)"/)
        if (match) fileName = match[1]
      }

      console.log(`Received response with filename: ${fileName}`);

      // Stream the response to a blob
      const reader = response.body.getReader()
      const chunks = []
      let receivedLength = 0
      const contentLength = response.headers.get("Content-Length")
        ? parseInt(response.headers.get("Content-Length")!)
        : undefined

      console.log(`Content-Length: ${contentLength || 'unknown'}`);

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        receivedLength += value.length
        // Update progress if possible
        if (contentLength) {
          const progress = Math.round((receivedLength / contentLength) * 100)
          console.log(`Download progress: ${progress}%`);
          setConversion((prev) => ({ ...prev, progress }))
        }
      }
      
      console.log(`Download complete, received ${receivedLength} bytes`);
      setConversion((prev) => ({ ...prev, progress: 100 }))
      
      if (chunks.length === 0 || receivedLength === 0) {
        throw new Error("Received empty file from server");
      }
      
      const blob = new Blob(chunks, { type: format === "MP3" ? "audio/mpeg" : "video/mp4" })
      const downloadUrl = URL.createObjectURL(blob)

      // Extract video title from filename
      const videoTitle = fileName.replace(/\.[^/.]+$/, "").replace(/-/g, " ");

      setConversion({
        isConverting: false,
        progress: 100,
        downloadUrl,
        convertedTitle: videoTitle,
      })

      // Add to history
      const newConversion: ConversionHistory = {
        id: crypto.randomUUID(), // Use crypto.randomUUID() instead of Date.now() for more reliable IDs
        url,
        format,
        quality: quality + (format === "MP3" ? " kbps" : "p"),
        title: videoTitle,
        timestamp: new Date(),
        downloadUrl,
        filename: fileName,
      }
      const newHistory = [newConversion, ...history.slice(0, 2)]
      saveHistory(newHistory)

      toast({
        title: "Conversion Complete!",
        description: "Your file is ready for download",
      })
    } catch (error) {
      console.error("Conversion error:", error);
      setConversion({
        isConverting: false,
        progress: 0,
        downloadUrl: null,
        convertedTitle: null,
      })
      toast({
        title: "Conversion Failed",
        description: error instanceof Error ? error.message : "An error occurred during conversion",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={handleConvert}>
            Retry
          </Button>
        ),
      })
    }
  }

  const isConvertDisabled = !url || !validateYouTubeUrl(url) || !quality || conversion.isConverting

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-black-500">
                <img src="/favicon.png" alt="YT Converter Logo" className="w-6 h-6 object-contain" />
              </div>
              <span className="text-xl font-bold text-gray-900">YT Converter</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Convert YouTube Videos</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Download your favorite YouTube videos as MP3 or MP4 files. Fast, free, and high-quality conversions.
          </p>

          {/* Conversion Form */}
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-6">
              <div className="space-y-6">
                {/* URL Input */}
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="Paste YouTube URL here..."
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className={`text-lg h-12 ${urlError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    aria-label="YouTube URL input"
                    aria-describedby={urlError ? "url-error" : undefined}
                  />
                  {urlError && (
                    <p id="url-error" className="text-sm text-red-500 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-1" />
                      {urlError}
                    </p>
                  )}
                </div>

                {/* Format Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Select Format</label>
                  <div className="flex space-x-2">
                    <Button
                      variant={format === "MP3" ? "default" : "outline"}
                      onClick={() => handleFormatChange("MP3")}
                      className="flex-1 h-12"
                      aria-pressed={format === "MP3"}
                    >
                      <Music className="w-4 h-4 mr-2" />
                      MP3 Audio
                    </Button>
                    <Button
                      variant={format === "MP4" ? "default" : "outline"}
                      onClick={() => handleFormatChange("MP4")}
                      className="flex-1 h-12"
                      aria-pressed={format === "MP4"}
                    >
                      <Video className="w-4 h-4 mr-2" />
                      MP4 Video
                    </Button>
                  </div>
                </div>

                {/* Quality Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-gray-700">Select Quality</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {getQualityOptions().map((option) => (
                      <QualityBlock
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        isSelected={quality === option.value}
                        onClick={() => setQuality(option.value)}
                        format={format}
                      />
                    ))}
                  </div>
                </div>

                {/* Convert Button */}
                <Button onClick={handleConvert} disabled={isConvertDisabled} className="w-full h-12 text-lg" size="lg">
                  {conversion.isConverting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5 mr-2" />
                      Convert & Download
                    </>
                  )}
                </Button>

                {/* Progress Bar */}
                {conversion.isConverting && (
                  <div className="space-y-2">
                    <Progress value={conversion.progress} className="w-full" />
                    <p className="text-sm text-gray-600 text-center">
                      Converting your video... {Math.round(conversion.progress)}%
                    </p>
                  </div>
                )}

                {/* Download Link */}
                {conversion.downloadUrl && conversion.convertedTitle && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center mb-2">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-green-700 font-medium">Conversion Complete!</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{conversion.convertedTitle}</p>
                    <Button asChild className="w-full">
                      <a href={conversion.downloadUrl} download={conversion.convertedTitle + "." + format.toLowerCase()}>
                        <Download className="w-4 h-4 mr-2" />
                        Download {format} File
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Features Section */}
        <section className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Zap className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
            <p className="text-gray-600">Convert videos in seconds with our optimized processing engine.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure & Private</h3>
            <p className="text-gray-600">Your files are processed securely and deleted after conversion.</p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Mobile Friendly</h3>
            <p className="text-gray-600">Works perfectly on all devices - desktop, tablet, and mobile.</p>
          </div>
        </section>

        {/* Conversion History */}
        {history.length > 0 && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Recent Conversions
                </CardTitle>
                <CardDescription>Your last 3 conversions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="secondary">{item.format}</Badge>
                          <Badge variant="outline">{item.quality}</Badge>
                          <FormattedDate date={item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)} />
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={item.downloadUrl} download={item.filename || `${item.title}.${item.format.toLowerCase()}`}>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <nav className="flex space-x-6">
              <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900">
                Terms of Service
              </Link>
            </nav>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} YT Converter. All rights reserved.</p>
          </div>
        </div>
      </footer>
      <Toaster />
    </div>
  )
}
