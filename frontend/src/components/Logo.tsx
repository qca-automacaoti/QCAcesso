import logoEscura from '../assets/logo-qca.png'
import logoClara from '../assets/logo-qca-light.png'

interface LogoProps {
  href: string
  label: string
  /** "light" para fundos azul-marinho; "dark" para fundos claros. */
  variant?: 'light' | 'dark'
}

export function Logo({ href, label, variant = 'dark' }: LogoProps) {
  return (
    <a className={variant === 'light' ? 'brand brand-light' : 'brand'} href={href} aria-label={label}>
      <img className="brand-logo" src={variant === 'light' ? logoClara : logoEscura} alt="Queiroz Cavalcanti Advocacia" width={389} height={94} />
      <span className="brand-name">QCAcesso</span>
    </a>
  )
}
