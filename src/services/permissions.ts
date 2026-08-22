import pb from '@/lib/pocketbase/client'

export interface MyPermissionsResponse {
  permissions: Record<string, string>
}

export const getMyPermissions = (): Promise<MyPermissionsResponse> =>
  pb.send('/backend/v1/my-permissions', { method: 'GET' })
