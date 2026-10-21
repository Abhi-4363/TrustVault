/**
 * TrustVault Backend - File Signature & Magic Number Validation Middleware (Stage 7)
 * Strictly verifies the binary headers (magic numbers) of uploaded files against their
 * declared extensions/MIME types to prevent executable injection (e.g. .exe or shell script
 * renamed as .pdf or .png).
 */

import fs from 'fs';
import path from 'path';

// Known malicious executable signatures
const EXECUTABLE_SIGNATURES = [
  // Windows PE (Portable Executable - EXE, DLL, SYS, SCR): MZ
  { name: 'Windows PE Executable', magic: [0x4d, 0x5a] },
  // Linux ELF binary: \x7fELF
  { name: 'Linux ELF Binary', magic: [0x7f, 0x45, 0x4c, 0x46] },
  // Shell script shebang: #!
  { name: 'Shell / Script Shebang', magic: [0x23, 0x21] },
  // Mach-O macOS binaries
  { name: 'Mach-O Binary (32-bit)', magic: [0xfe, 0xed, 0xfa, 0xce] },
  { name: 'Mach-O Binary (64-bit)', magic: [0xfe, 0xed, 0xfa, 0xcf] },
  { name: 'Mach-O Binary (Reverse 32)', magic: [0xce, 0xfa, 0xed, 0xfe] },
  { name: 'Mach-O Binary (Reverse 64)', magic: [0xcf, 0xfa, 0xed, 0xfe] },
  // Java class / Mach-O Universal: 0xCAFEBABE
  { name: 'Java Class / Mach-O Universal', magic: [0xca, 0xfe, 0xba, 0xbe] },
];

/**
 * Checks if buffer matches a specific magic byte array at offset
 */
function matchesBytes(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Inspects initial bytes to verify if file matches known document/image signatures
 * or if it contains forbidden executable signatures.
 */
export function validateFileBuffer(buffer, ext) {
  const normalizedExt = ext.toLowerCase();

  // 1. Check for forbidden executable signatures regardless of extension
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (matchesBytes(buffer, sig.magic)) {
      return {
        valid: false,
        reason: `File begins with dangerous executable signature: ${sig.name}`,
      };
    }
  }

  // Also check if text contains shebang in the first line
  const initialText = buffer.slice(0, 100).toString('utf8', 0, Math.min(buffer.length, 100));
  if (initialText.startsWith('#!') || /^\s*#!\/(bin|usr)/i.test(initialText)) {
    return {
      valid: false,
      reason: 'Executable shell script shebang detected in file content.',
    };
  }

  // 2. Validate declared extension against true magic signatures
  switch (normalizedExt) {
    case '.pdf': {
      // PDF must start with %PDF- (0x25 0x50 0x44 0x46 0x2D)
      // Allow within first 1024 bytes per PDF standard, but typically at byte 0
      const headerStr = buffer.slice(0, 1024).toString('binary');
      if (!headerStr.includes('%PDF-')) {
        return {
          valid: false,
          reason: 'File declared as PDF does not contain valid %PDF- magic signature.',
        };
      }
      return { valid: true };
    }

    case '.png': {
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (!matchesBytes(buffer, pngMagic)) {
        return {
          valid: false,
          reason: 'File declared as PNG does not contain valid PNG magic signature.',
        };
      }
      return { valid: true };
    }

    case '.jpg':
    case '.jpeg': {
      // JPEG: FF D8 FF
      const jpegMagic = [0xff, 0xd8, 0xff];
      if (!matchesBytes(buffer, jpegMagic)) {
        return {
          valid: false,
          reason: 'File declared as JPEG does not contain valid JPEG SOI magic signature.',
        };
      }
      return { valid: true };
    }

    case '.gif': {
      // GIF87a or GIF89a
      const isGif =
        matchesBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        matchesBytes(buffer, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
      if (!isGif) {
        return {
          valid: false,
          reason: 'File declared as GIF does not contain valid GIF magic signature.',
        };
      }
      return { valid: true };
    }

    case '.docx':
    case '.xlsx':
    case '.pptx':
    case '.zip': {
      // ZIP archive header (standard for OpenXML formats): PK\x03\x04
      const zipMagic = [0x50, 0x4b, 0x03, 0x04];
      if (!matchesBytes(buffer, zipMagic)) {
        return {
          valid: false,
          reason: `File declared as ${normalizedExt} does not contain valid ZIP/OpenXML magic signature.`,
        };
      }
      return { valid: true };
    }

    case '.txt':
    case '.csv':
    case '.json':
    case '.md':
    case '.log': {
      // Plain text must not contain binary null bytes in the first 512 bytes
      const sampleSize = Math.min(buffer.length, 512);
      for (let i = 0; i < sampleSize; i++) {
        if (buffer[i] === 0x00) {
          return {
            valid: false,
            reason: 'Binary null bytes detected in text document.',
          };
        }
      }
      return { valid: true };
    }

    default: {
      // If extension is not one of the explicitly allowed types, reject
      return {
        valid: false,
        reason: `Unsupported file extension: '${normalizedExt}'. Allowed extensions are: .pdf, .png, .jpg, .jpeg, .gif, .docx, .xlsx, .pptx, .zip, .txt, .csv, .json, .md, .log`,
      };
    }
  }
}

/**
 * Express middleware to inspect file magic bytes immediately after Multer upload.
 * If file fails validation, it is immediately deleted from disk and rejected with 415.
 */
export async function validateFileSignature(req, res, next) {
  if (!req.file) {
    // Let downstream controller handle missing file if needed
    return next();
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  try {
    // Read first 2048 bytes for signature inspection
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(2048);
    const bytesRead = fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);

    const actualBuffer = buffer.slice(0, bytesRead);
    const result = validateFileBuffer(actualBuffer, ext);

    if (!result.valid) {
      // Purge quarantined file from disk immediately
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkErr) {
        console.error('[File Cleanup Error]:', unlinkErr);
      }

      delete req.file;

      return res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: result.reason || 'File signature does not match allowed types or contains executable code.',
        },
      });
    }

    next();
  } catch (err) {
    console.error('[File Signature Validation Error]:', err);

    // Ensure quarantined file is removed on error
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}

    delete req.file;

    return res.status(415).json({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Unable to verify file binary signature.',
      },
    });
  }
}
