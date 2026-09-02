import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Index from './pages/Index'
import OperacaoDia from './pages/OperacaoDia'
import Pipeline from './pages/Pipeline'
import Login from './pages/Login'
import Foundation from './pages/Foundation'
import SubstituicoesLista from './pages/SubstituicoesLista'
import SubstituicaoDetalhe from './pages/SubstituicaoDetalhe'
import SubstituicaoNova from './pages/SubstituicaoNova'
import SubstituicaoAjuste from './pages/SubstituicaoAjuste'
import Qualificacoes from './pages/Qualificacoes'
import Atividades from './pages/Atividades'
import Slas from './pages/Slas'
import Propostas from './pages/Propostas'
import Fechamentos from './pages/Fechamentos'
import OrdensExecucao from './pages/OrdensExecucao'
import PropostaPublica from './pages/PropostaPublica'

import NotFound from './pages/NotFound'
import AccessDenied from './pages/AccessDenied'
import Layout from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './hooks/use-auth'
import { PermissionsProvider } from './hooks/use-permissions'
import { usePermissions } from './hooks/use-permissions'
import { useIsSuperAdmin } from './hooks/use-is-superadmin'
import { MUTATIONS_ENABLED } from './lib/feature-flags'

function AdministrationRoute({ children }: { children: React.ReactNode }) {
  const { hasPermission, loading } = usePermissions()
  const allowed = [
    'foundation.manage',
    'usuarios.admin',
    'equipes.admin',
    'perfis.admin',
    'permissoes.admin',
    'vinculos.admin',
    'parametros.gerenciar',
  ].some(hasPermission)
  if (loading) return null
  return allowed ? children : <AccessDenied />
}

function RestrictedProfileRoute({ children }: { children: React.ReactNode }) {
  const { perfilSlug, loading } = useIsSuperAdmin()
  if (loading) return null
  if (!perfilSlug) return <AccessDenied profileUnavailable />
  return perfilSlug === 'negociacao-propria' ? <AccessDenied /> : children
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <PermissionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/p/:token" element={<PropostaPublica />} />
            <Route path="/login" element={<Login />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <OperacaoDia />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analises"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pipeline"
                element={
                  <ProtectedRoute>
                    <Pipeline />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/foundation"
                element={
                  <ProtectedRoute>
                    <AdministrationRoute>
                      <Foundation />
                    </AdministrationRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/qualificacao"
                element={
                  <ProtectedRoute>
                    <RestrictedProfileRoute>
                      <Qualificacoes />
                    </RestrictedProfileRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/atividades"
                element={
                  <ProtectedRoute>
                    <Atividades />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/slas"
                element={
                  <ProtectedRoute>
                    <Slas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/propostas"
                element={
                  <ProtectedRoute>
                    <Propostas />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fechamentos"
                element={
                  <ProtectedRoute>
                    <Fechamentos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ordens-execucao"
                element={
                  <ProtectedRoute>
                    <RestrictedProfileRoute>
                      <OrdensExecucao />
                    </RestrictedProfileRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/substituicoes"
                element={
                  <ProtectedRoute>
                    <SubstituicoesLista />
                  </ProtectedRoute>
                }
              />
              {MUTATIONS_ENABLED ? (
                <>
                  <Route
                    path="/substituicoes/nova"
                    element={
                      <ProtectedRoute>
                        <SubstituicaoNova />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/substituicoes/:id/ajustar"
                    element={
                      <ProtectedRoute>
                        <SubstituicaoAjuste />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/substituicoes/:id"
                    element={
                      <ProtectedRoute>
                        <SubstituicaoDetalhe />
                      </ProtectedRoute>
                    }
                  />
                </>
              ) : (
                <>
                  <Route path="/substituicoes/nova" element={<NotFound />} />
                  <Route path="/substituicoes/:id/ajustar" element={<NotFound />} />
                  <Route
                    path="/substituicoes/:id"
                    element={
                      <ProtectedRoute>
                        <SubstituicaoDetalhe />
                      </ProtectedRoute>
                    }
                  />
                </>
              )}
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </PermissionsProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
