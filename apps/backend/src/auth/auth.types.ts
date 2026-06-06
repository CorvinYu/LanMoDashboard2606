export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
};
