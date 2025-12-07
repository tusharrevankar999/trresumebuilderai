import {useState, useCallback} from 'react'
import {useDropzone} from 'react-dropzone'
import { formatSize } from '../lib/utils'

interface FileUploaderProps {
    onFileSelect?: (file: File | null) => void;
    accept?: string; // e.g., ".pdf,.docx,.doc,.txt"
    hasError?: boolean;
}

const FileUploader = ({ onFileSelect, accept = ".pdf", hasError = false }: FileUploaderProps) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0] || null;

        onFileSelect?.(file);
    }, [onFileSelect]);

    const maxFileSize = 20 * 1024 * 1024; // 20MB in bytes

    // Parse accept string into dropzone format
    const getAcceptObject = () => {
        const extensions = accept.split(',').map(ext => ext.trim().replace('.', ''));
        const acceptObj: Record<string, string[]> = {};
        
        extensions.forEach(ext => {
            if (ext === 'pdf') {
                acceptObj['application/pdf'] = ['.pdf'];
            } else if (ext === 'docx' || ext === 'doc') {
                acceptObj['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] = ['.docx'];
                acceptObj['application/msword'] = ['.doc'];
            } else if (ext === 'txt') {
                acceptObj['text/plain'] = ['.txt'];
            }
        });
        
        return acceptObj;
    };

    const {getRootProps, getInputProps, isDragActive, acceptedFiles} = useDropzone({
        onDrop,
        multiple: false,
        accept: getAcceptObject(),
        maxSize: maxFileSize,
    })

    const file = acceptedFiles[0] || null;



    return (
        <div className={`w-full gradient-border ${hasError ? 'border-2 border-red-300 bg-red-50' : ''}`}>
            <div {...getRootProps()}>
                <input {...getInputProps()} />

                <div className="space-y-4 cursor-pointer">
                    {file ? (
                        <div className="uploader-selected-file" onClick={(e) => e.stopPropagation()}>
                            <img src="/images/pdf.png" alt="pdf" className="size-10" />
                            <div className="flex items-center space-x-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-700 truncate max-w-xs">
                                        {file.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {formatSize(file.size)}
                                    </p>
                                </div>
                            </div>
                            <button className="p-2 cursor-pointer" onClick={(e) => {
                                onFileSelect?.(null)
                            }}>
                                <img src="/icons/cross.svg" alt="remove" className="w-4 h-4" />
                            </button>
                        </div>
                    ): (
                        <div>
                            <div className="mx-auto w-16 h-16 flex items-center justify-center mb-2">
                                <img src="/icons/info.svg" alt="upload" className="size-20" />
                            </div>
                            <p className="text-lg text-gray-500">
                                <span className="font-semibold">
                                    Click to upload
                                </span> or drag and drop
                            </p>
                            <p className="text-lg text-gray-500">
                                {accept.split(',').map(ext => ext.trim().toUpperCase()).join(', ')} (max {formatSize(maxFileSize)})
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
export default FileUploader
