import Link from 'next/link';
import Image from 'next/image';
import type { ITree } from '@hongyi/shared';
import { formatPrice, formatSpecs, TREE_STATUS_MAP } from '@hongyi/shared';

interface TreeCardProps {
  tree: ITree;
}

export function TreeCard({ tree }: TreeCardProps) {
  const statusText = TREE_STATUS_MAP[tree.status] || tree.status;

  return (
    <Link
      href={`/trees/${tree.treeId}`}
      className="group block overflow-hidden rounded-xl bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <Image
          src={tree.coverImage || '/images/tree-placeholder.jpg'}
          alt={tree.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        {/* Status badge */}
        <span className="absolute left-2 top-2 rounded-full bg-brand-green px-2.5 py-0.5 text-xs font-medium text-white">
          {statusText}
        </span>
        {/* Tree ID */}
        <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
          {tree.treeId}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold text-gray-800">{tree.name}</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          {tree.species} · {formatSpecs(tree.specs.height, tree.specs.crown)}
        </p>
        {tree.fengshui?.symbol && (
          <p className="mt-1 truncate text-xs text-brand-gold">{tree.fengshui.symbol}</p>
        )}
        <p className="mt-2 text-base font-bold text-brand-red">
          ¥{formatPrice(tree.price.sale)}
        </p>
      </div>
    </Link>
  );
}
