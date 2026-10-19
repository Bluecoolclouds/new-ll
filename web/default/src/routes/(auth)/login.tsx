import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/(auth)/login')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: '/sign-in',
      search: location.search,
      replace: true,
    })
  },
})
