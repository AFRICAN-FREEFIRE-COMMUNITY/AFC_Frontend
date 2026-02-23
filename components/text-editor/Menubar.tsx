"use client";

import { useState } from "react";
import { type Editor } from "@tiptap/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { Toggle } from "../ui/toggle";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  Italic,
  Link,
  Link2Off,
  ListIcon,
  ListOrdered,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Underline,
  Undo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { FONT_FAMILIES, FONT_SIZES } from "./extensions";

interface iAppProps {
  editor: Editor | null;
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border shrink-0 mx-0.5" />;
}

function ToolbarToggle({
  isActive,
  onToggle,
  tooltip,
  children,
  className,
}: {
  isActive: boolean;
  onToggle: () => void;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          size="sm"
          pressed={isActive}
          onPressedChange={onToggle}
          className={cn(
            "h-8 w-8 p-0 rounded transition-colors",
            isActive
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "hover:bg-muted text-muted-foreground hover:text-foreground",
            className
          )}
        >
          {children}
        </Toggle>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  tooltip,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          type="button"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export const Menubar = ({ editor }: iAppProps) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");

  if (!editor) return null;

  const textStyleAttrs = editor.getAttributes("textStyle");
  const currentFontFamily = textStyleAttrs.fontFamily ?? "default";
  const currentFontSize = textStyleAttrs.fontSize ?? "default";

  const openLinkPopover = () => {
    const existing = editor.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href, target: "_blank" })
        .run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setLinkOpen(false);
    setLinkUrl("");
  };

  const insertImage = () => {
    const trimmed = imageUrl.trim();
    if (trimmed) {
      editor.chain().focus().setImage({ src: trimmed }).run();
    }
    setImageOpen(false);
    setImageUrl("");
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="sticky top-0 z-50 border-b border-input bg-card/95 backdrop-blur-sm rounded-t-md">

        {/* ── Row 1: Font controls ────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-input/60">

          {/* Font family */}
          <Select
            value={currentFontFamily}
            onValueChange={(val) => {
              if (val === "default") {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(val).run();
              }
            }}
          >
            <SelectTrigger className="h-7 w-[130px] text-xs border-input focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem
                  key={f.value}
                  value={f.value}
                  className="text-xs"
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Font size */}
          <Select
            value={currentFontSize}
            onValueChange={(val) => {
              if (val === "default") {
                editor.chain().focus().unsetFontSize().run();
              } else {
                editor.chain().focus().setFontSize(val).run();
              }
            }}
          >
            <SelectTrigger className="h-7 w-[95px] text-xs border-input focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder="Size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default" className="text-xs text-muted-foreground">
                Default
              </SelectItem>
              {FONT_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                  <span className="ml-2 text-muted-foreground">{s.value}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Row 2: Formatting controls ──────────────────────────── */}
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5">

          {/* Text formatting */}
          <div className="flex items-center gap-0.5">
            <ToolbarToggle
              isActive={editor.isActive("bold")}
              onToggle={() => editor.chain().focus().toggleBold().run()}
              tooltip="Bold (Ctrl+B)"
            >
              <Bold size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("italic")}
              onToggle={() => editor.chain().focus().toggleItalic().run()}
              tooltip="Italic (Ctrl+I)"
            >
              <Italic size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("underline")}
              onToggle={() => editor.chain().focus().toggleUnderline().run()}
              tooltip="Underline (Ctrl+U)"
            >
              <Underline size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("strike")}
              onToggle={() => editor.chain().focus().toggleStrike().run()}
              tooltip="Strikethrough"
            >
              <Strikethrough size={14} />
            </ToolbarToggle>
          </div>

          <ToolbarDivider />

          {/* Headings */}
          <div className="flex items-center gap-0.5">
            <ToolbarToggle
              isActive={editor.isActive("heading", { level: 1 })}
              onToggle={() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              }
              tooltip="Heading 1"
            >
              <Heading1Icon size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("heading", { level: 2 })}
              onToggle={() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              }
              tooltip="Heading 2"
            >
              <Heading2Icon size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("heading", { level: 3 })}
              onToggle={() =>
                editor.chain().focus().toggleHeading({ level: 3 }).run()
              }
              tooltip="Heading 3"
            >
              <Heading3Icon size={14} />
            </ToolbarToggle>
          </div>

          <ToolbarDivider />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <ToolbarToggle
              isActive={editor.isActive("bulletList")}
              onToggle={() => editor.chain().focus().toggleBulletList().run()}
              tooltip="Bullet list"
            >
              <ListIcon size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive("orderedList")}
              onToggle={() => editor.chain().focus().toggleOrderedList().run()}
              tooltip="Numbered list"
            >
              <ListOrdered size={14} />
            </ToolbarToggle>
          </div>

          <ToolbarDivider />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <ToolbarToggle
              isActive={editor.isActive({ textAlign: "left" })}
              onToggle={() =>
                editor.chain().focus().setTextAlign("left").run()
              }
              tooltip="Align left"
            >
              <AlignLeft size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive({ textAlign: "center" })}
              onToggle={() =>
                editor.chain().focus().setTextAlign("center").run()
              }
              tooltip="Align center"
            >
              <AlignCenter size={14} />
            </ToolbarToggle>
            <ToolbarToggle
              isActive={editor.isActive({ textAlign: "right" })}
              onToggle={() =>
                editor.chain().focus().setTextAlign("right").run()
              }
              tooltip="Align right"
            >
              <AlignRight size={14} />
            </ToolbarToggle>
          </div>

          <ToolbarDivider />

          {/* Link */}
          <div className="flex items-center gap-0.5">
            <Popover open={linkOpen} onOpenChange={setLinkOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={editor.isActive("link")}
                      onPressedChange={openLinkPopover}
                      className={cn(
                        "h-8 w-8 p-0 rounded transition-colors",
                        editor.isActive("link")
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Link size={14} />
                    </Toggle>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {editor.isActive("link") ? "Edit link" : "Insert link"}
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-72 p-3" side="bottom" align="start">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {editor.isActive("link") ? "Edit link" : "Insert link"}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          applyLink();
                        }
                      }}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      type="button"
                      className="h-8 shrink-0 text-xs px-3"
                      onClick={applyLink}
                    >
                      {editor.isActive("link") ? "Update" : "Add"}
                    </Button>
                  </div>
                  {editor.isActive("link") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="h-7 text-xs text-destructive hover:text-destructive justify-start px-1"
                      onClick={removeLink}
                    >
                      <Link2Off size={12} className="mr-1.5" />
                      Remove link
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Image */}
          <div className="flex items-center gap-0.5">
            <Popover open={imageOpen} onOpenChange={setImageOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ImageIcon size={14} />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Insert image
                </TooltipContent>
              </Tooltip>
              <PopoverContent className="w-80 p-3" side="bottom" align="start">
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Insert image by URL
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://example.com/image.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          insertImage();
                        }
                      }}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      type="button"
                      className="h-8 shrink-0 text-xs px-3"
                      onClick={insertImage}
                      disabled={!imageUrl.trim()}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <ToolbarDivider />

          {/* Block elements */}
          <div className="flex items-center gap-0.5">
            <ToolbarToggle
              isActive={editor.isActive("blockquote")}
              onToggle={() => editor.chain().focus().toggleBlockquote().run()}
              tooltip="Blockquote"
            >
              <Quote size={14} />
            </ToolbarToggle>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              tooltip="Horizontal rule"
            >
              <Minus size={14} />
            </ToolbarButton>
          </div>

          <ToolbarDivider />

          {/* History */}
          <div className="flex items-center gap-0.5">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              tooltip="Undo (Ctrl+Z)"
            >
              <Undo size={14} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              tooltip="Redo (Ctrl+Y)"
            >
              <Redo size={14} />
            </ToolbarButton>
          </div>

        </div>
      </div>
    </TooltipProvider>
  );
};
