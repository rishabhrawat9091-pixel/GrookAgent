import { NextResponse } from "next/server";
import { chunks } from "../chunks/chunkings";
type pdftype = {
    pdf: string;
}

export const filecleaning = ({ pdf }: pdftype) => {
    const cleanedText = pdf
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (!cleanedText) {
        return NextResponse.json({ "message": "clean text is not available" })
    }

    return cleanedText;


}