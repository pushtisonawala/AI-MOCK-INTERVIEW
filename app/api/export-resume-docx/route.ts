import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { TailoredResume } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { tailoredResume } = (await req.json()) as { tailoredResume: TailoredResume };

    if (!tailoredResume) {
      return NextResponse.json({ error: "tailoredResume is required" }, { status: 400 });
    }

    const contact = tailoredResume.contact || {};
    const children: Paragraph[] = [];

    // Name — the only "heading-level" element at the very top, everything else lives in
    // the normal document body (no headers/footers) so ATS parsers can read all of it.
    children.push(
      new Paragraph({
        text: contact.name || "Tailored Resume",
        heading: HeadingLevel.TITLE,
      })
    );

    // Contact line: email | phone | location | links...
    const contactParts = [contact.email, contact.phone, contact.location, ...(contact.links || [])].filter(
      (v): v is string => !!v && v.trim().length > 0
    );
    if (contactParts.length > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: contactParts.join("  |  "), size: 20, color: "555555" })],
          spacing: { after: 200 },
        })
      );
    }

    if (tailoredResume.summary) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: tailoredResume.summary, italics: true })],
          spacing: { after: 300 },
        })
      );
    }

    for (const section of tailoredResume.sections || []) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        })
      );

      if (section.entries && section.entries.length > 0) {
        for (const entry of section.entries) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: entry.subheading, bold: true })],
              spacing: { before: 150, after: 80 },
            })
          );
          for (const bullet of entry.bullets || []) {
            children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
          }
        }
      } else {
        for (const bullet of section.bullets || []) {
          children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
        }
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="tailored-resume.docx"`,
      },
    });
  } catch (err) {
    console.error("export-resume-docx error", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
