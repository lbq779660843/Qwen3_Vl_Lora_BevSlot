import { useState, useRef, useEffect } from 'react'
import './App.css'

interface Defect {
  label: string
  bbox: [number, number, number, number]
}

interface DetectionResult {
  result: string
  defects: Defect[]
  image_size: {
    width: number
    height: number
  }
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [showDebug, setShowDebug] = useState(false)
  const [prompt, setPrompt] = useState<string>('请检测这张图片里的缺陷：')
  const [mode, setMode] = useState<'detection' | 'chat'>('detection')
  const [chatMessage, setChatMessage] = useState<string>('')
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string, image?: string, timestamp: number}>>([])
const [chatLoading, setChatLoading] = useState(false)
  const [reflection, setReflection] = useState<string>('')
  const [reflectionLoading, setReflectionLoading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0])
      setResult(null)
      setError('')
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFile) return

    setLoading(true)
    setError('')
    setResult(null)
    setDebugInfo('')

    const formData = new FormData()
    formData.append('image', selectedFile)
    formData.append('prompt', prompt) // +'并找出一处明显的电阻被烧毁的地方'

    try {
      const startTime = Date.now()
      setDebugInfo(`📤 Sending request...\nImage: ${selectedFile.name}\nSize: ${(selectedFile.size / 1024 / 1024).toFixed(2)}MB\nPrompt: ${prompt}`)

      const response = await fetch('/detect_defects', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setResult(data)

      const elapsedTime = Date.now() - startTime
      setDebugInfo(prev => prev + `\n✅ Response received in ${(elapsedTime / 1000).toFixed(1)}s` +
        `\n📊 Defects found: ${data.defects.length}` +
        `\n🖼️  Image size: ${data.image_size.width}x${data.image_size.height}`)

      console.log('[RESPONSE] Real API result:', data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMsg)
      setDebugInfo(prev => prev + `\n❌ ERROR: ${errorMsg}`)
      console.error('[ERROR]', err)
    } finally {
      setLoading(false)
    }
  }

  const handleChatSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!chatMessage.trim()) return

    const userMessage = chatMessage.trim()
    setChatMessage('')
    setChatLoading(true)

    // Add user message to history
    const timestamp = Date.now()
    setChatHistory(prev => [...prev, {
      role: 'user',
      content: userMessage,
      image: selectedFile ? URL.createObjectURL(selectedFile) : undefined,
      timestamp
    }])

    try {
      let response
      if (selectedFile) {
        // Call chat_with_image API
        const formData = new FormData()
        formData.append('image', selectedFile)
        formData.append('message', userMessage)

        const apiResponse = await fetch('/chat_with_image', {
          method: 'POST',
          body: formData,
        })

        if (!apiResponse.ok) {
          throw new Error(`HTTP error! status: ${apiResponse.status}`)
        }

        response = await apiResponse.json()
      } else {
        // Call chat API
        const apiResponse = await fetch('/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: userMessage }),
        })

        if (!apiResponse.ok) {
          throw new Error(`HTTP error! status: ${apiResponse.status}`)
        }

        response = await apiResponse.json()
      }

      // Add assistant response to history
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: response.response,
        timestamp: Date.now()
      }])

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Chat error occurred'
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `❌ 错误: ${errorMsg}`,
        timestamp: Date.now()
      }])
    } finally {
      setChatLoading(false)
    }
  }

const clearChat = () => {
    setChatHistory([])
    setError('')
  }

  const handleReflection = async () => {
    if (!result || reflectionLoading) return
    setReflectionLoading(true)
    setReflection('')
    setError('')

    try {
      const defectList = result.defects.map((d, i) =>
        `缺陷${i + 1}：${d.label}，位置：(${d.bbox[0]}, ${d.bbox[1]}, ${d.bbox[2]}, ${d.bbox[3]})`
      ).join('\n')

      const promptText = `你刚刚完成了一次工业产品缺陷检测，以下是检测结果：
${defectList || '未检测到任何缺陷。'}

请基于以上检测结果，从以下角度进行发散性思考分析：
1. 这些缺陷可能是什么原因导致的？（工艺、材料、操作、环境等）
2. 这些缺陷会对产品质量和使用寿命产生什么影响？
3. 后续应该采取什么措施来改进？
4. 能否从检测结果中推断出更多有价值的信息？

请用专业的视角和清晰的条理进行分析展示。`

      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText }),
      })

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setReflection(data.response)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发散性思考生成失败')
    } finally {
      setReflectionLoading(false)
    }
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory, chatLoading])
  useEffect(() => {
    if (!result?.defects || result.defects.length === 0) {
      console.log('[DEBUG] No defects in result or result is empty')
      return
    }

    if (!canvasRef.current || !imageRef.current) {
      console.log('[DEBUG] Canvas or image ref not available')
      return
    }

    const canvas = canvasRef.current
    const img = imageRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      console.log('[DEBUG] Canvas context 2d not available')
      return
    }

    console.log('[DEBUG] Starting defect drawing...')
    console.log('[DEBUG] Image complete:', img.complete)
    console.log('[DEBUG] Image natural size:', img.naturalWidth, 'x', img.naturalHeight)

    const performDrawing = () => {
      try {
        console.log('[DEBUG] Performing drawing on canvas...')
        
        // Set canvas size to match image
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height

        console.log('[DEBUG] Canvas size set to:', canvas.width, 'x', canvas.height)

        // Draw image
        ctx.drawImage(img, 0, 0)
        console.log('[DEBUG] Image drawn to canvas')

        // Draw defect boxes
        result.defects.forEach((defect, index) => {
          const [x11, y11, x21, y21] = defect.bbox 
          const x1 = Math.max(x11 - 0, 0)
          const x2 = Math.min(x21 - 0, canvas.width)
          const y1 = Math.max(y11 - 0, 0)
          const y2 = Math.min(y21 - 0, canvas.height)
          const width = x2 - x1
          const height = y2 - y1

          console.log(
            `[DEBUG] Drawing defect ${index + 1}/${result.defects.length}: ` +
            `label="${defect.label}", bbox=[${x1}, ${y1}, ${x2}, ${y2}], ` +
            `size=[${width}x${height}]`
          )

          // Draw rectangle with red border
          ctx.strokeStyle = '#FF0000'
          ctx.lineWidth = 3
          ctx.strokeRect(x1, y1, width, height)

          // Draw label background and text
          const labelText = `${defect.label} #${index + 1}`
          ctx.font = 'bold 16px Arial'
          const textMetrics = ctx.measureText(labelText)
          const textWidth = textMetrics.width
          const textHeight = 24
          const padding = 5

          // Draw semi-transparent dark background for label
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
          ctx.fillRect(x1 - 2, y1 - textHeight - 8, textWidth + padding * 2, textHeight + 2)

          // Draw label text in white
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 16px Arial'
          ctx.fillText(labelText, x1 + padding, y1 - 8)
        })

        console.log(`[DEBUG] ✅ Successfully drew ${result.defects.length} defects`)
      } catch (error) {
        console.error('[ERROR] Error during drawing:', error)
      }
    }

    // If image is already loaded, draw immediately
    if (img.complete) {
      performDrawing()
    } else {
      // Otherwise wait for load
      const onImageLoad = () => {
        console.log('[DEBUG] Image load event fired')
        performDrawing()
        img.removeEventListener('load', onImageLoad)
      }
      img.addEventListener('load', onImageLoad)
      
      // Add timeout in case image is stuck
      setTimeout(() => {
        if (img.complete) {
          performDrawing()
        }
      }, 500)
    }
  }, [result])

  return (
    <div className="app">
      <h1>星汉AI大模型v2.0 体验demo</h1>
      
      {/* 模式切换 */}
      <div className="mode-switcher">
        <button 
          className={`mode-btn ${mode === 'detection' ? 'active' : ''}`}
          onClick={() => setMode('detection')}
        >
          🔍 缺陷检测
        </button>
        <button 
          className={`mode-btn ${mode === 'chat' ? 'active' : ''}`}
          onClick={() => setMode('chat')}
        >
          💬 AI 对话
        </button>
      </div>

      {mode === 'detection' ? (
        <>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
              />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="prompt-input"
                rows={2}
                placeholder="输入检测提示词..."
              />
              <button type="submit" disabled={!selectedFile || loading}>
                {loading ? '⏳ 检测中...' : '🚀 开始检测'}
              </button>
            </div>
          </form>

          {error && <p className="error">❌ 错误：{error}</p>}

          {debugInfo && (
            <div className={`debug-panel ${showDebug ? 'expanded' : 'collapsed'}`}>
              <button 
                className="debug-toggle" 
                onClick={() => setShowDebug(!showDebug)}
                type="button"
              >
                {showDebug ? '🔽 调试信息' : '▶️ 调试信息'}
              </button>
              {showDebug && (
                <pre className="debug-content">{debugInfo}</pre>
              )}
            </div>
          )}

          <div className="container">
            {selectedFile && (
              <div className="preview-section">
                <h3>原始图像</h3>
                <img
                  ref={imageRef}
                  src={URL.createObjectURL(selectedFile)}
                  alt="Original"
                  className="preview-image"
                />
              </div>
            )}

            {result && (
              <>
<div className="canvas-section">
                    <h3>检测报告</h3>
                  
                  <div className="report-header">
                    <div className="report-title-row">
                      <span className="report-label">星汉AI大模型V2.0&nbsp;&nbsp;</span>
                      <span className="report-value">工业产品缺陷检测报告</span>
                    </div>
                    <div className="report-title-row">
                      <span className="report-label">检测时间：</span>
                      <span className="report-value">{new Date().toLocaleString('zh-CN')}</span>
                    </div>
                    <div className="report-title-row">
                      <span className="report-label">图像尺寸：</span>
                      <span className="report-value">{result.image_size.width} x {result.image_size.height} px</span>
                    </div>
                  </div>
                  <h3>缺陷可视化</h3>
                  {/* <p className="canvas-info">
                    Canvas: {canvasRef.current?.width || '?'} x {canvasRef.current?.height || '?'} px |
                    图片: {result.image_size.width} x {result.image_size.height} px
                  </p> */}
                  <canvas
                    ref={canvasRef}
                    className="result-canvas"
                    style={{ border: '1px solid #ccc' }}
                  />
                </div>

                <div className="result-section">
                  <h3>检测结果</h3>
                  {result.defects.length > 0 ? (
                    <>
                      <p className="success">
                        共检测到 <strong>{result.defects.length}</strong> 个缺陷
                      </p>
                      <table className="defect-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>缺陷类型</th>
                            <th>位置 (x1, y1, x2, y2)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.defects.map((defect, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td>{defect.label}</td>
                              <td>
                                ({defect.bbox[0]}, {defect.bbox[1]}, {defect.bbox[2]}, {defect.bbox[3]})
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <p className="success">未检测到缺陷</p>
                  )}
                </div>

                <div className="report-section">
                  <div className="report-content">
                    <div className="report-block">
                      <h4>检测项</h4>
                      <p>对上传图像进行缺陷检测，识别以下缺陷类型：表面划痕、边缘破损、裂纹、凹陷、色差、异物等。</p>
                    </div>

                    <div className="report-block">
                      <h4>检测结果</h4>
                      {result.defects.length > 0 ? (
                        <ul className="report-defect-list">
                          {result.defects.map((defect, idx) => (
                            <li key={idx}>
                              <strong>缺陷 {idx + 1}：</strong>{defect.label}
                              <span className="report-bbox">
                                &nbsp;[ {defect.bbox[0]}, {defect.bbox[1]}, {defect.bbox[2]}, {defect.bbox[3]} ]
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="report-no-defect">未检测到缺陷。</p>
                      )}
                    </div>

                    <div className="report-block">
                      <h4>评估</h4>
                      <div className="report-assessment">
                        {result.defects.length === 0 ? (
                          <span className="assessment-pass">合格</span>
                        ) : (
                          <span className="assessment-fail">
                            不合格（共 {result.defects.length} 处缺陷）
                          </span>
                        )}
                      </div>
                      <p className="report-detail">
                        {result.defects.length === 0
                          ? '图像中未发现明显缺陷，产品外观质量符合标准。'
                          : `图像中检出 ${result.defects.length} 处缺陷（${result.defects.map(d => d.label).join('、')}），建议进一步人工复核。`}
                      </p>
                    </div>

                    <div className="report-block">
                      <h4>发散性思考</h4>
                      <button
                        className="reflection-btn"
                        onClick={handleReflection}
                        disabled={reflectionLoading}
                      >
                        {reflectionLoading ? '思考中...' : '启动分析'}
                      </button>
                      {reflectionLoading && (
                        <p className="reflection-loading">模型正在分析检测结果，请稍候...</p>
                      )}
                      {reflection && (
                        <div className="reflection-result">
                          {reflection.split('\n').map((line, i) => (
                            <p key={i} className={line.startsWith('#') || line.match(/^\d+[.、：:]/)? 'reflection-heading' : 'reflection-line'}>
                              {line || '\u00A0'}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* 对话模式 */
        <div className="chat-mode">
          <div className="chat-container" ref={chatContainerRef}>
            <div className="chat-messages">
              {chatHistory.length === 0 ? (
                <div className="welcome-message">
                  <h3>💬 欢迎使用星汉AI大模型v2.0 对话</h3>
                  <p>您可以发送文字消息，或上传图片后进行多模态对话。</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    <div className="message-header">
                      <span className="message-role">
                        {msg.role === 'user' ? '👤 您' : '🤖 AI'}
                      </span>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {msg.image && (
                      <div className="message-image">
                        <img src={msg.image} alt="User uploaded" />
                      </div>
                    )}
                    <div className="message-content">
                      {msg.content.split('\n').map((line, lineIdx) => (
                        <p key={lineIdx}>{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="message assistant loading">
                  <div className="message-header">
                    <span className="message-role">🤖 AI</span>
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleChatSubmit} className="chat-input-form">
            <div className="chat-input-group">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="chat-image-input"
                id="chat-image"
              />
              <label htmlFor="chat-image" className="image-upload-btn">
                📎 {selectedFile ? '更换图片' : '上传图片'}
              </label>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="输入您的消息..."
                className="chat-text-input"
                disabled={chatLoading}
              />
              <button 
                type="submit" 
                disabled={!chatMessage.trim() || chatLoading}
                className="chat-send-btn"
              >
                {chatLoading ? '⏳ 发送中...' : '📤 发送'}
              </button>
              {chatHistory.length > 0 && (
                <button 
                  type="button" 
                  onClick={clearChat}
                  className="clear-chat-btn"
                >
                  🗑️ 清空
                </button>
              )}
            </div>
            {selectedFile && (
              <div className="chat-image-preview">
                <p>📎 已选择图片: {selectedFile.name}</p>
                <img src={URL.createObjectURL(selectedFile)} alt="Preview" />
              </div>
            )}
          </form>

          {error && <p className="error">❌ 错误：{error}</p>}
        </div>
      )}
    </div>
  )
}

export default App
