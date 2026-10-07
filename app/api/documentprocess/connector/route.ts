import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { connectorId, credentials } = body;

    if (!connectorId || !credentials) {
      return NextResponse.json(
        { error: "Connector data is required" },
        { status: 400 }
      );
    }

    if (connectorId === "gmail") {
      const {
        clientId,
        clientSecret,
        userEmail,
        scope,
      } = credentials;

      if (!clientId || !clientSecret || !userEmail) {
        return NextResponse.json(
          { error: "Missing Gmail credentials" },
          { status: 400 }
        );
      }

      // TODO:
      // Encrypt and save these in your database.
      //
      // NEVER save clientSecret as plain text.

      console.log({
        connectorId,
        clientId,
        userEmail,
        scope,
      });

      return NextResponse.json({
        success: true,
        connector: "gmail",
        message: "Gmail connector saved",
      });
    }

    return NextResponse.json(
      { error: "Unsupported connector" },
      { status: 400 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to save connector" },
      { status: 500 }
    );
  }
}