import { BookType } from "@/entities/BookType";
import { normalizeToIsbn13 } from "@/lib/isbn-services/types";

export const checkCoverExists = async (
  isbn: string,
): Promise<{ exists: boolean; blob?: Blob; source?: string }> => {
  try {
    const response = await fetch(`/api/book/fetchCover?isbn=${isbn}`);
    if (!response.ok) return { exists: false };
    const blob = await response.blob();
    const source = response.headers.get("X-Cover-Source") || "unknown";
    return { exists: true, blob, source };
  } catch {
    return { exists: false };
  }
};

export const fetchBookDataByIsbn = async (
  isbn: string,
): Promise<Partial<BookType> | null> => {
  const cleanedIsbn = normalizeToIsbn13(isbn) ?? isbn.replace(/[^0-9X]/gi, "");
  if (!cleanedIsbn) return null;
  try {
    const response = await fetch(
      `/api/book/FillBookByIsbn?isbn=${cleanedIsbn}`,
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

export const uploadCover = async (
  bookId: number,
  coverBlob: Blob,
): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.set("cover", coverBlob, "cover.jpg");
    const response = await fetch(`/api/book/cover/${bookId}`, {
      method: "POST",
      body: formData,
    });
    return response.ok;
  } catch {
    return false;
  }
};
