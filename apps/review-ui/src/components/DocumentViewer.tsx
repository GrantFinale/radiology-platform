import React, { useState } from 'react';
import { FileText, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { getDocumentUrl } from '../api/documents';

interface Props {
  documentId: string;
  fileName: string;
  mimeType: string;
}

export default function DocumentViewer({ documentId, fileName, mimeType }: Props) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const url = getDocumentUrl(documentId);

  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');

  return (
    <div className="flex flex-col h-full border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
      <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileText className="w-4 h-4" />
          <span className="font-medium truncate max-w-[200px]">{fileName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(25, z - 25))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-500 min-w-[40px] text-center">{zoom}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Rotate"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 flex items-start justify-center scrollbar-thin">
        {isPdf ? (
          <iframe
            src={`${url}#toolbar=0`}
            className="w-full h-full border-0 bg-white"
            title={fileName}
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'top center',
            }}
          />
        ) : isImage ? (
          <img
            src={url}
            alt={fileName}
            className="max-w-full shadow-lg"
            style={{
              transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
              transformOrigin: 'top center',
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <FileText className="w-16 h-16 mb-3" />
            <p className="text-sm">Preview not available for this file type</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-sm text-clinical-600 hover:underline"
            >
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
