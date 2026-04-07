'use client';

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export function WeChatFloat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Float button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-6"
        aria-label="微信客服"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-2 text-lg font-bold text-brand-navy">微信咨询</h3>
            <p className="mb-4 text-sm text-gray-500">
              扫码添加微信客服，获取专属庭院方案
            </p>

            <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400">
              微信二维码
            </div>

            <p className="text-sm text-gray-600">
              聂先生 <span className="font-medium text-brand-navy">13607449139</span>
            </p>
            <p className="text-xs text-gray-400">微信同号 · 随时咨询</p>
          </div>
        </div>
      )}
    </>
  );
}
