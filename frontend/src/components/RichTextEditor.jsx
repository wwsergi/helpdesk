import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';
import apiClient from '../lib/api';

export default function RichTextEditor({ value, onChange, placeholder = 'Escribe un mensaje...', minHeight = '120px' }) {
    const fileInputRef = useRef(null);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({ inline: false, allowBase64: false }),
            Placeholder.configure({ placeholder }),
        ],
        content: value || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            // Treat empty editor (just <p></p>) as empty string
            onChange(html === '<p></p>' ? '' : html);
        },
        editorProps: {
            handlePaste(view, event) {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));
                if (imageItem) {
                    event.preventDefault();
                    const file = imageItem.getAsFile();
                    uploadAndInsert(file);
                    return true;
                }
                return false;
            },
            handleDrop(view, event) {
                const files = Array.from(event.dataTransfer?.files || []);
                const imageFile = files.find(f => f.type.startsWith('image/'));
                if (imageFile) {
                    event.preventDefault();
                    uploadAndInsert(imageFile);
                    return true;
                }
                return false;
            },
        },
    });

    // Sync external value changes (e.g. form reset)
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        const incoming = value || '';
        if (current !== incoming && (incoming === '' || incoming === '<p></p>')) {
            editor.commands.setContent('');
        }
    }, [value, editor]);

    const uploadAndInsert = async (file) => {
        if (!file || !editor) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await apiClient.post('/upload/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            editor.chain().focus().setImage({ src: res.data.url }).run();
        } catch (e) {
            console.error('Image upload failed', e);
        }
    };

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadAndInsert(file);
        e.target.value = '';
    };

    if (!editor) return null;

    const ToolbarBtn = ({ onClick, active, title, children }) => (
        <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onClick(); }}
            title={title}
            className={`px-2 py-1 rounded text-sm font-medium transition ${active ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500">
            {/* Toolbar */}
            <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-200 bg-gray-50 flex-wrap">
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Negrita">
                    <strong>B</strong>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiva">
                    <em>I</em>
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Tachado">
                    <s>S</s>
                </ToolbarBtn>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Lista">
                    ≡
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada">
                    1.
                </ToolbarBtn>
                <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Código">
                    {'</>'}
                </ToolbarBtn>
                <div className="w-px h-4 bg-gray-300 mx-1" />
                {/* Image upload */}
                <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); fileInputRef.current?.click(); }}
                    title="Insertar imagen"
                    className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-600 hover:bg-gray-100 transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Imagen
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            </div>

            {/* Editor area */}
            <EditorContent
                editor={editor}
                style={{ minHeight }}
                className="prose prose-sm max-w-none px-3 py-2 focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[inherit] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded [&_.ProseMirror_img]:my-2"
            />
        </div>
    );
}
