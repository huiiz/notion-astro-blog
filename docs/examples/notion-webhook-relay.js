export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return json(
        {
          ok: false,
          message: "Method not allowed"
        },
        405
      );
    }

    const rawBody = await request.text();
    let payload = {};

    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return json(
        {
          ok: false,
          message: "Invalid JSON payload"
        },
        400
      );
    }

    if (payload?.verification_token) {
      console.log(
        JSON.stringify({
          type: "notion_verification_token",
          verification_token: payload.verification_token
        })
      );

      return json({
        ok: true,
        message: "Verification token received. Copy it from the Worker logs and paste it into Notion.",
        verification_token: payload.verification_token
      });
    }

    const verificationToken = env.NOTION_WEBHOOK_VERIFICATION_TOKEN || "";
    const signature = request.headers.get("X-Notion-Signature") || "";

    if (verificationToken) {
      const isValid = await verifyNotionSignature(rawBody, signature, verificationToken);

      if (!isValid) {
        return json(
          {
            ok: false,
            message: "Invalid Notion signature"
          },
          401
        );
      }
    }

    const eventType = env.NOTION_WEBHOOK_EVENT_TYPE || "notion-content-updated";
    const repository = `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;

    if (!env.GITHUB_OWNER || !env.GITHUB_REPO || !env.GITHUB_DISPATCH_TOKEN) {
      return json(
        {
          ok: false,
          message: "Missing GitHub relay secrets"
        },
        500
      );
    }

    const dispatchResponse = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: {
          source: "notion-webhook",
          notion_event_id: payload?.id || "",
          notion_event_type: payload?.type || "",
          notion_entity_id: payload?.entity?.id || "",
          notion_workspace_id: payload?.workspace_id || "",
          notion_timestamp: payload?.timestamp || ""
        }
      })
    });

    if (!dispatchResponse.ok) {
      const errorText = await dispatchResponse.text();
      console.error(
        JSON.stringify({
          type: "github_dispatch_failed",
          status: dispatchResponse.status,
          body: errorText
        })
      );

      return json(
        {
          ok: false,
          message: "Failed to trigger GitHub Actions",
          status: dispatchResponse.status
        },
        502
      );
    }

    console.log(
      JSON.stringify({
        type: "github_dispatch_sent",
        repository,
        eventType,
        notionEventType: payload?.type || ""
      })
    );

    return json({
      ok: true,
      message: "GitHub deployment workflow triggered",
      repository,
      eventType
    });
  }
};

async function verifyNotionSignature(rawBody, signature, verificationToken) {
  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(verificationToken),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signedBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const calculatedSignature = `sha256=${bufferToHex(signedBuffer)}`;
  return safeEqual(calculatedSignature, signature);
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
