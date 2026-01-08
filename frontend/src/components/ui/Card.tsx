import type React from 'react'

interface CardProps {
    children: React.ReactNode
    className?: string
    title?: string
    subtitle?: string
    actions?: React.ReactNode
}

export default function Card({
    children,
    className = '',
    title,
    subtitle,
    actions
}: CardProps) {
    return (
        <div className={`bg-white rounded-xl shadow-md overflow-hidden ${className}`}>
            {(title || actions) && (
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        {title && (
                            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                        )}
                        {subtitle && (
                            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    )
}
