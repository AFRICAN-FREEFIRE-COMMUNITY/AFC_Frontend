"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Bold, Italic, Underline, List, ListOrdered, Link, RemoveFormatting } from "lucide-react"

interface SimpleRichTextEditorProps {
  initialValue: string
  onChange: (value: string) => void
}

export function SimpleRichTextEditor({ initialValue, onChange }: SimpleRichTextEditorProps) {
  const [editorContent, setEditorContent] = useState(initialValue)

  useEffect(() => {
    setEditorContent(initialValue)
  }, [initialValue])

  const handleChange = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.innerHTML
    setEditorContent(newContent)
    onChange(newContent)
  }

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value)
  }

  return (
    <div className="border rounded-md p-2">
      <div className="mb-2 flex items-center space-x-2 border-b pb-2">
        <button
          type="button"
          onClick={() => execCommand("bold")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand("italic")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand("underline")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Underline"
        >
          <Underline size={18} />
        </button>
        <div className="h-4 w-px bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => execCommand("insertUnorderedList")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand("insertOrderedList")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>
        <div className="h-4 w-px bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => execCommand("createLink", prompt("Enter link URL"))}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Insert Link"
        >
          <Link size={18} />
        </button>
        <button
          type="button"
          onClick={() => execCommand("removeFormat")}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors"
          title="Clear Formatting"
        >
          <RemoveFormatting size={18} />
        </button>
      </div>
      <div
        className="border rounded-md p-2 min-h-[200px]"
        contentEditable
        dangerouslySetInnerHTML={{ __html: editorContent }}
        onInput={handleChange}
      />
    </div>
  )
}
