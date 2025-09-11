import axios from "axios";
import { Knex } from "knex";
import { Logger } from "winston";
import { usersRepo } from "../repositories/user.repo";
import AppError from "../types/errors";
import { IUserRow } from "../types/knex-tables";
import jwt from "jsonwebtoken";
import type { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";

type LoginWithGitHubArgs = {
  code: string;
  log?: Logger;
  trx?: Knex.Transaction;
};

type LoginWithGitHubResult = {
  user: Pick<IUserRow, "user_id" | "name" | "email">;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

type AuthUser =
  RestEndpointMethodTypes["users"]["getAuthenticated"]["response"]["data"];
type UserEmails =
  RestEndpointMethodTypes["users"]["listEmailsForAuthenticatedUser"]["response"]["data"];

interface GitHubOAuthAccessTokenSuccess {
  access_token: string;
  token_type: "bearer";
  scope: string;
  expires_in?: number; // seconds until access_token expires
  refresh_token?: string;
  refresh_token_expires_in?: number; // seconds until refresh_token expires
}

export async function loginWithGitHub({
  code,
  log,
  trx,
}: LoginWithGitHubArgs): Promise<LoginWithGitHubResult> {
  const clientId = process.env.GITHUB_CLIENT_ID as string | undefined;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET as string | undefined;
  const jwtSecret = process.env.JWT_SECRET as string | undefined;
  const refreshSecret = process.env.REFRESH_SECRET as string | undefined;
  const csrfSecret = process.env.CSRF_SECRET_KEY as string | undefined;

  if (
    !clientId ||
    !clientSecret ||
    !jwtSecret ||
    !refreshSecret ||
    !csrfSecret
  ) {
    throw new AppError("INTERNAL", "Server misconfiguration");
  }

  // 1) Exchange code for GitHub access token
  const tokenResp = await axios.post<GitHubOAuthAccessTokenSuccess>(
    "https://github.com/login/oauth/access_token",
    { client_id: clientId, client_secret: clientSecret, code },
    { headers: { Accept: "application/json" } },
  );

  const ghAccessToken = tokenResp.data?.access_token as string | undefined;
  if (!ghAccessToken) {
    log?.error("loginWithGitHub:no_access_token", { data: tokenResp.data });
    throw new AppError("FORBIDDEN", "GitHub authorization failed");
  }

  // 2) Fetch GitHub profile
  const userResp = await axios.get<AuthUser>("https://api.github.com/user", {
    headers: { Authorization: `token ${ghAccessToken}` },
  });
  const ghUser = userResp.data;

  // 3) Fetch emails (pick primary or first)
  const emailsResp = await axios.get<UserEmails>(
    "https://api.github.com/user/emails",
    {
      headers: { Authorization: `token ${ghAccessToken}` },
    },
  );
  const primaryEmailObj =
    emailsResp.data.find((e) => e.primary) ?? emailsResp.data[0];
  const email = primaryEmailObj?.email;
  if (!email) {
    log?.warn("loginWithGitHub:no_email", { githubId: ghUser?.id });
    throw new AppError("FORBIDDEN", "Unable to retrieve GitHub email");
  }

  // 4) Find or create local user; ensure provider fields
  let user = await usersRepo.findByEmail(email, trx);

  if (user) {
    if (!user.provider || user.provider === "local") {
      await usersRepo.updateProviderFields(
        user.user_id,
        "github",
        String(ghUser.id),
        trx,
      );
      log?.info("loginWithGitHub:provider_updated", { userId: user.user_id });
    }
  } else {
    const displayName = ghUser.name || ghUser.login || "GitHub User";
    user = await usersRepo.insertUser(
      {
        name: displayName,
        email,
        password: "",
        provider: "github",
        provider_id: String(ghUser.id),
      },
      trx,
    );
    log?.info("loginWithGitHub:new_user_created", {
      userId: user.user_id,
      email,
    });
  }

  // 5) Issue tokens
  const accessToken = jwt.sign(
    { userId: user.user_id, email: user.email },
    jwtSecret,
    {
      expiresIn: "1h",
    },
  );

  const refreshToken = jwt.sign(
    { userId: user.user_id, email: user.email },
    refreshSecret,
    {
      expiresIn: "7d",
    },
  );

  const csrfToken = jwt.sign(
    { userId: user.user_id, email: user.email, issuedAt: Date.now() },
    csrfSecret,
  );

  return {
    user: { user_id: user.user_id, name: user.name, email: user.email },
    accessToken,
    refreshToken,
    csrfToken,
  };
}
