import { ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'

interface AccessDeniedProps {
  profileUnavailable?: boolean
}

const AccessDenied = ({ profileUnavailable = false }: AccessDeniedProps) => (
  <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-6">
    <section className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <ShieldX aria-hidden="true" className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-bold text-slate-900">
        {profileUnavailable ? 'Perfil não validado' : 'Acesso não autorizado'}
      </h1>
      <p className="mt-3 text-slate-600">
        {profileUnavailable
          ? 'Não foi possível validar as permissões do seu perfil. Por segurança, nenhuma área operacional foi liberada.'
          : 'Esta área não está disponível para o seu perfil de acesso.'}
      </p>
      <Link
        to={profileUnavailable ? '/login' : '/'}
        className="mt-6 inline-flex rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700"
      >
        {profileUnavailable ? 'Voltar para o login' : 'Voltar para o início'}
      </Link>
    </section>
  </main>
)

export default AccessDenied
