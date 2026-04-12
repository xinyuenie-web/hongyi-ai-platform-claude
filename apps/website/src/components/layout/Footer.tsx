import Link from 'next/link';
import { TreePine, Phone, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-brand-navy text-gray-300">
      <div className="container-page py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <TreePine className="h-6 w-6 text-brand-gold" />
              <span className="text-lg font-bold text-white">AI · 红艺花木</span>
            </div>
            <p className="text-sm leading-relaxed">
              高端庭院别墅造型花木解决方案。
              <br />
              真院照+真树木+真想法 = 真效果。
              <br />
              11年专业经验，百亩基地直供。
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-4 font-semibold text-white">快速导航</h3>
            <div className="space-y-2 text-sm">
              <Link href="/trees" className="block hover:text-brand-gold">精品树木</Link>
              <Link href="/styles" className="block hover:text-brand-gold">庭院风格</Link>
              <Link href="/appointment" className="block hover:text-brand-gold">预约看树</Link>
              <Link href="/quotation" className="block hover:text-brand-gold">在线报价</Link>
              <Link href="/care" className="block hover:text-brand-gold">养护指南</Link>
              <Link href="/contact" className="block hover:text-brand-gold">联系我们</Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 font-semibold text-white">联系方式</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-brand-gold" />
                <span>聂先生 13607449139（微信同号）</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-gold" />
                <span>湖南省浏阳市</span>
              </div>
              <p className="text-xs text-gray-400">
                微信小程序/公众号/企业微信：红艺花木
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-700 pt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} 浏阳红艺造型花木有限公司 版权所有
        </div>
      </div>
    </footer>
  );
}
