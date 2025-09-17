import { create, verify, getNumericDate, Header, Payload } from "https://deno.land/x/djwt@v2.9/mod.ts";

const alg = "HS256" as const;

export interface JwtUserClaims {
  sub: string; // user id or email
  email: string;
  nome?: string;
  papel?: string;
  cooperativa_id?: string;
}

export const signJwt = async (secret: string, claims: JwtUserClaims, expiresInSeconds = 60 * 60 * 24) => {
  const header: Header = { alg, typ: "JWT" };
  const payload: Payload = {
    iss: "urede-local",
    aud: "urede-app",
    iat: getNumericDate(0),
    exp: getNumericDate(expiresInSeconds),
    ...claims,
  };
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return await create(header, payload, key);
};

export const verifyJwt = async (secret: string, token: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const payload = await verify(token, key, alg);
  return payload as Payload & JwtUserClaims;
};

