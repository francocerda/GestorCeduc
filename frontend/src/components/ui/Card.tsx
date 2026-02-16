import type React from 'react'

interface CardProps {
    children: React.ReactNode
    className?: string
    title?: string
    subtitle?: string
    actions?: React.ReactNode
    noPadding?: boolean
}

export default function Card({
    children,
    className = '',
    title,
    subtitle,
    actions,
    noPadding = false
}: CardProps) {
    return (
        <div className={`bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden transition-shadow hover:shadow-md ${className}`}>
            {(title || actions) && (
                <div className="px-6 py-4 border-b border-slate-100/80 flex justify-between items-center">
                    <div>
                        {title && (
                            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className={noPadding ? '' : 'p-6'}>
                {children}
            </div>
        </div>
    )
}
