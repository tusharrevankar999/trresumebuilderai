export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;
    // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a module
    loadPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
        // Set the worker source to use local file
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsLib = lib;
        isLoading = false;
        return lib;
    });

    return loadPromise;
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (context) {
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = "high";
        }

        await page.render({ canvasContext: context!, viewport }).promise;

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            ); // Set quality to maximum (1.0)
        });
    } catch (err) {
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err}`,
        };
    }
}

export async function extractTextFromPdf(file: File): Promise<string> {
    try {
        console.log('📖 Loading PDF.js library...');
        const lib = await loadPdfJs();
        console.log('📖 PDF.js loaded, reading file...');
        
        const arrayBuffer = await file.arrayBuffer();
        console.log('📖 File read, size:', arrayBuffer.byteLength, 'bytes');
        
        const pdf = await lib.getDocument({ 
            data: arrayBuffer,
            verbosity: 0 // Suppress warnings
        }).promise;
        
        console.log('📖 PDF loaded, pages:', pdf.numPages);
        
        let fullText = '';
        
        // Extract text from all pages
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`📖 Extracting text from page ${i}/${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // More robust text extraction
            const pageText = textContent.items
                .map((item: any) => {
                    // Handle different text item formats
                    if (typeof item === 'string') {
                        return item;
                    }
                    if (item.str) {
                        return item.str;
                    }
                    if (item.text) {
                        return item.text;
                    }
                    return '';
                })
                .filter((text: string) => text && text.trim().length > 0)
                .join(' ');
            
            if (pageText.trim().length > 0) {
                fullText += pageText + '\n';
                console.log(`📖 Page ${i} extracted ${pageText.length} characters`);
            } else {
                console.warn(`⚠️ Page ${i} had no extractable text`);
            }
        }
        
        const trimmedText = fullText.trim();
        console.log('📖 Total extracted text length:', trimmedText.length);
        
        if (trimmedText.length < 10) {
            console.error('❌ Warning: Very little text extracted from PDF. This might be a scanned/image-based PDF.');
        }
        
        return trimmedText;
    } catch (err) {
        console.error('❌ Error extracting text from PDF:', err);
        if (err instanceof Error) {
            console.error('Error message:', err.message);
            console.error('Error stack:', err.stack);
        }
        
        // Save error to Firebase
        try {
            const { saveErrorLog } = await import('./firebase');
            await saveErrorLog(err instanceof Error ? err : new Error(String(err)), {
                errorType: 'PDF_TEXT_EXTRACTION',
                fileName: file.name,
                fileSize: file.size,
            });
        } catch (logError) {
            console.error('Failed to log error to Firebase:', logError);
        }
        
        return '';
    }
}
