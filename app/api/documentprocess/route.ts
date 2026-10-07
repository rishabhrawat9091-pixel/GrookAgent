import { NextRequest, NextResponse } from "next/server";
import PdfParse from "pdf-parse";
import { filecleaning } from "./clean/fileclean";
import { chunks } from "./chunks/chunkings";
import { embedding } from "./embeddings/embedded";
import { pinecone } from "./vectordb/pineconedb";
import { db } from "@/db";
import { agentDocuments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { ensureDatabaseTables } from "@/db/init";

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseTables();
    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) {
      const docs = await db
        .select()
        .from(agentDocuments)
        .orderBy(desc(agentDocuments.createdAt));
      return NextResponse.json({ documents: docs });
    }

    const docs = await db
      .select()
      .from(agentDocuments)
      .where(eq(agentDocuments.agentId, agentId))
      .orderBy(desc(agentDocuments.createdAt));

    return NextResponse.json({ documents: docs });
  } catch (error: any) {
    console.error("documentprocess GET error:", error?.message || error);
    return NextResponse.json(
      { message: "Failed to load documents", error: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseTables();
    const formdata = await req.formData();
    const file = formdata.get("file") as File | null;
    const textInput = (formdata.get("text") as string | null) || "";
    const agentId = (formdata.get("agentId") as string | null) || "default";
    const title = (formdata.get("title") as string | null) || "";

    if (!file && !textInput.trim()) {
      return NextResponse.json(
        { message: "Please provide either a document file or text content." },
        { status: 400 }
      );
    }

    let rawText = "";
    let docName = "Document";
    let fileExtension = "text";

    if (file) {
      docName = file.name;
      fileExtension = file.name.split(".").pop()?.toLowerCase() || "doc";
      const buffer = Buffer.from(await file.arrayBuffer());

      if (!buffer || buffer.length === 0) {
        return NextResponse.json(
          { message: "Uploaded file is empty." },
          { status: 400 }
        );
      }

      const isPdf =
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type === "application/pdf";

      if (isPdf) {
        try {
          const pdftext = await PdfParse(buffer);
          rawText = pdftext.text;
        } catch (pdfErr: any) {
          console.error("PDF parse failed:", pdfErr?.message || pdfErr);
          return NextResponse.json(
            { message: "Failed to read PDF file content. Ensure it is a valid PDF." },
            { status: 400 }
          );
        }
      } else {
        // Plain text, markdown, CSV, or formatted text
        rawText = buffer.toString("utf-8");
      }
    } else {
      rawText = textInput.trim();
      docName = title.trim() || `Knowledge Note (${new Date().toLocaleDateString()})`;
      fileExtension = "note";
    }

    if (!rawText || rawText.trim().length === 0) {
      return NextResponse.json(
        { message: "No readable text content found in document." },
        { status: 400 }
      );
    }

    const cleandata: any = await filecleaning({ pdf: rawText });
    if (!cleandata) {
      return NextResponse.json(
        { message: "Failed to clean and normalize text data." },
        { status: 400 }
      );
    }

    const datachunk: any = await chunks(cleandata);
    if (!datachunk || datachunk.length === 0) {
      return NextResponse.json(
        { message: "Failed to create chunks from document text." },
        { status: 400 }
      );
    }

    const embeddings: any = await embedding({ chunks: datachunk });
    if (!embeddings || embeddings.length === 0) {
      return NextResponse.json(
        { message: "No embeddings were generated — check HUGGINGFACE_API_KEY" },
        { status: 500 }
      );
    }

    const database: any = await pinecone({
      embeddings: embeddings,
      chunks: datachunk,
      metadata: {
        fileName: docName,
        agentId: agentId,
      },
      docId: `${agentId}_${Date.now()}`,
    });

    if (!database) {
      return NextResponse.json(
        { message: "Failed to store vectors in Pinecone database." },
        { status: 500 }
      );
    }

    // Save document tracking record in PostgreSQL
    let savedRecord = null;
    try {
      const [inserted] = await db
        .insert(agentDocuments)
        .values({
          agentId: agentId,
          fileName: docName,
          fileType: fileExtension,
          chunksCount: datachunk.length,
          status: "indexed",
        })
        .returning();
      savedRecord = inserted;
    } catch (dbErr) {
      console.warn("Could not insert agent_document record:", dbErr);
    }

    return NextResponse.json({
      message: "success",
      chunks: datachunk.length,
      database: database,
      document: savedRecord || {
        fileName: docName,
        chunksCount: datachunk.length,
        status: "indexed",
      },
    });
  } catch (error: any) {
    const detail = error?.message || JSON.stringify(error) || "Unknown error";
    console.error("documentprocess error:", detail);
    return NextResponse.json(
      { message: "error occurred", error: detail },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureDatabaseTables();
    const documentId = req.nextUrl.searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json(
        { message: "documentId parameter is required" },
        { status: 400 }
      );
    }

    await db
      .delete(agentDocuments)
      .where(eq(agentDocuments.id, documentId));

    return NextResponse.json({ message: "Document removed successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { message: "Failed to delete document", error: error?.message },
      { status: 500 }
    );
  }
}