declare module '#auth-utils' {
  interface User {
    id: string
    name: string
    email: string
  }

  interface UserSession {
    loggedInAt?: number
  }
}

export {}
