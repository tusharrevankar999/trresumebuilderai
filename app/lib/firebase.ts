// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, Timestamp, collectionGroup, where, doc, setDoc, updateDoc } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCRFteABTCp_myJn-Lp558OLNUtYdH9U_4",
  authDomain: "trstyle-bd6e4.firebaseapp.com",
  projectId: "trstyle-bd6e4",
  storageBucket: "trstyle-bd6e4.firebasestorage.app",
  messagingSenderId: "173550803521",
  appId: "1:173550803521:web:2d312bebac5c65ffd784c0",
  measurementId: "G-R9CCS4EFKG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Initialize Analytics (only in browser)
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export interface ResumeRecord {
  fullName?: string;
  email?: string;
  phone?: string;
  location?: string;
  summary?: string;
  experience?: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate: string;
    description: string[];
  }>;
  education?: Array<{
    degree: string;
    school: string;
    gpa?: string;
    graduationDate?: string;
  }>;
  skills?: {
    technical: string[];
    soft: string[];
  };
  projects?: Array<{
    name: string;
    description: string;
  }>;
  certifications?: Array<{
    name: string;
  }>;
  achievements?: Array<{
    name: string;
  }>;
  template?: string;
  exportFormat?: 'PDF' | 'DOC' | 'PNG' | 'JPG';
  downloaded?: boolean; // Flag to indicate if resume was downloaded
  downloadedAt?: Timestamp;
  createdAt?: Timestamp; // When resume was first created/uploaded
  updatedAt?: Timestamp; // When resume was last updated
}

export interface ATSAnalysisRecord {
  fullName?: string;
  email?: string;
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  overallScore?: number;
  keywordMatch?: number;
  atsCompatibility?: number;
  contentStrength?: number;
  lengthScore?: number;
  missingSkills?: string[];
  overusedWords?: string[];
  analyzedAt: Timestamp;
}

export interface CoverLetterRecord {
  fullName?: string;
  email?: string;
  companyName?: string;
  jobTitle?: string;
  jobDescription?: string;
  keyRequirements?: string;
  coverLetter?: string;
  generatedAt: Timestamp;
}

/**
 * Save or update resume record to Firestore in resume_builder collection (flat structure, like ats_analyses)
 * Creates a new document if it doesn't exist, or updates existing one
 * @param resumeData - Resume data to save
 * @param isDownload - Whether this is a download action (true) or creation (false)
 * @param documentId - Optional document ID to update existing record
 */
export const saveResumeRecord = async (
  resumeData: ResumeRecord, 
  isDownload: boolean = false,
  documentId?: string
): Promise<string | null> => {
  try {
    // Get user email - use email from resume data or default to 'anonymous'
    const userEmail = resumeData.email || 'anonymous';
    
    console.log("🔄 Attempting to save resume record to Firestore...");
    console.log("📦 Data being saved:", {
      fullName: resumeData.fullName,
      email: userEmail,
      template: resumeData.template,
      exportFormat: resumeData.exportFormat,
      isDownload,
      documentId: documentId || 'new',
      hasExperience: !!resumeData.experience?.length,
      hasEducation: !!resumeData.education?.length
    });
    
    // Prepare base data
    const baseData: any = {
      fullName: resumeData.fullName || '',
      email: userEmail,
      phone: resumeData.phone || '',
      location: resumeData.location || '',
      summary: resumeData.summary || '',
      experience: resumeData.experience || [],
      education: resumeData.education || [],
      skills: resumeData.skills || { technical: [], soft: [] },
      projects: resumeData.projects || [],
      certifications: resumeData.certifications || [],
      achievements: resumeData.achievements || [],
      template: resumeData.template || '',
      updatedAt: Timestamp.now(),
    };
    
    // If updating existing document
    if (documentId) {
      const updateData: any = {
        ...baseData,
        downloaded: isDownload,
        updatedAt: Timestamp.now(),
      };
      
      if (isDownload) {
        updateData.downloadedAt = Timestamp.now();
        updateData.exportFormat = resumeData.exportFormat || 'PDF';
      }
      
      const docRef = doc(db, "resume_builder", documentId);
      await updateDoc(docRef, updateData);
      console.log("✅ Resume record updated successfully!");
      console.log("🆔 Document ID:", documentId);
      console.log("📄 Collection: resume_builder");
      return documentId;
    }
    
    // Creating new document
    const dataToSave: any = {
      ...baseData,
      downloaded: isDownload,
      createdAt: Timestamp.now(),
    };
    
    if (isDownload) {
      dataToSave.downloadedAt = Timestamp.now();
      dataToSave.exportFormat = resumeData.exportFormat || 'PDF';
    } else {
      // For created but not downloaded, set exportFormat to null
      dataToSave.exportFormat = null;
    }
    
    console.log("📤 Sending to Firestore:", {
      collection: "resume_builder",
      dataKeys: Object.keys(dataToSave),
      downloaded: dataToSave.downloaded
    });
    
    // Save to flat collection: resume_builder (similar to ats_analyses and cover_letters)
    const docRef = await addDoc(collection(db, "resume_builder"), dataToSave);
    console.log("✅ Resume record saved successfully!");
    console.log("📄 Collection: resume_builder");
    console.log("🆔 Document ID:", docRef.id);
    console.log("🔗 Full path: resume_builder/" + docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("❌ Error saving resume record to Firestore:");
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    
    // Save error to Firebase
    try {
      await saveErrorLog(error instanceof Error ? error : new Error(String(error)), {
        errorType: 'FIREBASE_SAVE_RESUME',
        page: 'builder',
        action: isDownload ? 'saveResumeRecord_download' : 'saveResumeRecord_create',
        errorCode: error?.code,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    // Check for common Firestore errors
    if (error?.code === 'permission-denied') {
      console.error("⚠️ Permission denied! Check Firestore security rules.");
      alert("⚠️ Permission denied! Please check Firestore security rules. Check browser console for details.");
    } else if (error?.code === 'unavailable') {
      console.error("⚠️ Firestore service unavailable. Check your internet connection.");
    } else {
      console.error("⚠️ Unexpected error saving to Firebase:", error);
    }
    
    // Don't throw - allow operation to continue even if save fails
    return null;
  }
};

/**
 * Save ATS analysis record to Firestore 'ats_analyses' collection
 */
export const saveATSAnalysisRecord = async (analysisData: ATSAnalysisRecord): Promise<string | null> => {
  try {
    console.log("🔄 Attempting to save ATS analysis record to Firestore...");
    console.log("📦 Data being saved:", {
      fullName: analysisData.fullName,
      email: analysisData.email,
      jobTitle: analysisData.jobTitle,
      overallScore: analysisData.overallScore
    });
    
    const docRef = await addDoc(collection(db, "ats_analyses"), analysisData);
    console.log("✅ ATS analysis record saved successfully!");
    console.log("📊 Collection: ats_analyses");
    console.log("🆔 Document ID:", docRef.id);
    console.log("🔗 Full path: ats_analyses/" + docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("❌ Error saving ATS analysis record to Firestore:");
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Full error:", error);
    
    // Check for common Firestore errors
    if (error?.code === 'permission-denied') {
      console.error("⚠️ Permission denied! Check Firestore security rules.");
    } else if (error?.code === 'unavailable') {
      console.error("⚠️ Firestore service unavailable. Check your internet connection.");
    }
    
    // Don't throw - allow analysis to continue even if save fails
    return null;
  }
};

/**
 * Save cover letter record to Firestore 'cover_letters' collection
 */
export const saveCoverLetterRecord = async (coverLetterData: CoverLetterRecord): Promise<string | null> => {
  try {
    console.log("🔄 Attempting to save cover letter record to Firestore...");
    console.log("📦 Data being saved:", {
      fullName: coverLetterData.fullName,
      email: coverLetterData.email,
      jobTitle: coverLetterData.jobTitle,
      companyName: coverLetterData.companyName
    });
    
    const docRef = await addDoc(collection(db, "cover_letters"), coverLetterData);
    console.log("✅ Cover letter record saved successfully!");
    console.log("📄 Collection: cover_letters");
    console.log("🆔 Document ID:", docRef.id);
    console.log("🔗 Full path: cover_letters/" + docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("❌ Error saving cover letter record to Firestore:");
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Full error:", error);
    
    // Check for common Firestore errors
    if (error?.code === 'permission-denied') {
      console.error("⚠️ Permission denied! Check Firestore security rules.");
    } else if (error?.code === 'unavailable') {
      console.error("⚠️ Firestore service unavailable. Check your internet connection.");
    }
    
    // Don't throw - allow generation to continue even if save fails
    return null;
  }
};

/**
 * Get all resume records from resume_builder collection (flat structure, like ats_analyses)
 */
export const getResumeRecords = async (): Promise<(ResumeRecord & { id: string })[]> => {
  try {
    console.log("🔄 Fetching resume records from Firestore...");
    
    const records: (ResumeRecord & { id: string })[] = [];
    
    try {
      // Try with ordering by createdAt or downloadedAt (newest first)
      let querySnapshot;
      try {
        // Try ordering by createdAt first (for all resumes)
        const q = query(collection(db, "resume_builder"), orderBy("createdAt", "desc"));
        querySnapshot = await getDocs(q);
        console.log("✅ Query with ordering by createdAt succeeded");
      } catch (orderError: any) {
        // If ordering fails (index not created), get all without ordering
        console.warn("⚠️ Could not order by createdAt, fetching all records without ordering...");
        console.warn("Order error:", orderError?.message);
        
        try {
          querySnapshot = await getDocs(collection(db, "resume_builder"));
          console.log("✅ Query without ordering succeeded");
        } catch (queryError: any) {
          console.error("❌ Query failed:", queryError?.message);
          throw queryError;
        }
      }
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        records.push({ 
          id: doc.id, 
          ...data 
        } as ResumeRecord & { id: string });
      });
      
      console.log(`✅ Retrieved ${records.length} resume records from resume_builder collection`);
    } catch (queryError: any) {
      console.error("❌ Error querying resume_builder collection:", queryError);
      console.error("Error code:", queryError?.code);
      console.error("Error message:", queryError?.message);
      
      // Log error to Firebase
      try {
        await saveErrorLog(queryError instanceof Error ? queryError : new Error(String(queryError)), {
          errorType: 'FIRESTORE_QUERY_ERROR',
          page: 'tradmin',
          action: 'getResumeRecords',
          errorCode: queryError?.code,
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      throw queryError;
    }
    
    // Sort manually by downloadedAt or createdAt (newest first)
    if (records.length > 0) {
      records.sort((a, b) => {
        const aTime = a.downloadedAt?.toDate?.()?.getTime() || 
                     (a.downloadedAt?.seconds ? a.downloadedAt.seconds * 1000 : 0) || 
                     a.createdAt?.toDate?.()?.getTime() || 
                     (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || 0;
        const bTime = b.downloadedAt?.toDate?.()?.getTime() || 
                     (b.downloadedAt?.seconds ? b.downloadedAt.seconds * 1000 : 0) || 
                     b.createdAt?.toDate?.()?.getTime() || 
                     (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || 0;
        return bTime - aTime; // Descending order (newest first)
      });
    }
    
    console.log(`✅ Total resume records retrieved: ${records.length}`);
    
    if (records.length === 0) {
      console.info("ℹ️ No resume records found. Records will appear here after users create or download resumes from the Builder page.");
      console.info("💡 To create a record: Go to /builder → Upload/Create resume → Data is saved automatically when resume is parsed or downloaded");
    }
    
    return records;
  } catch (error: any) {
    console.error("❌ Error fetching resume records:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    
    // Log error to Firebase
    try {
      await saveErrorLog(error instanceof Error ? error : new Error(String(error)), {
        errorType: 'FETCH_RESUME_RECORDS',
        page: 'tradmin',
        action: 'getResumeRecords',
        errorCode: error?.code,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return [];
  }
};

/**
 * Get all ATS analysis records
 */
export const getATSAnalysisRecords = async (): Promise<ATSAnalysisRecord[]> => {
  try {
    console.log("🔄 Fetching ATS analysis records from Firestore...");
    
    const q = query(collection(db, "ats_analyses"), orderBy("analyzedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const records: ATSAnalysisRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as ATSAnalysisRecord & { id: string });
    });
    
    console.log(`✅ Retrieved ${records.length} ATS analysis records`);
    return records;
  } catch (error: any) {
    console.error("❌ Error fetching ATS analysis records:", error);
    return [];
  }
};

/**
 * Get all cover letter records
 */
export const getCoverLetterRecords = async (): Promise<CoverLetterRecord[]> => {
  try {
    console.log("🔄 Fetching cover letter records from Firestore...");
    
    const q = query(collection(db, "cover_letters"), orderBy("generatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    const records: CoverLetterRecord[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as CoverLetterRecord & { id: string });
    });
    
    console.log(`✅ Retrieved ${records.length} cover letter records`);
    return records;
  } catch (error: any) {
    console.error("❌ Error fetching cover letter records:", error);
    return [];
  }
};

/**
 * Test Firebase connection
 */
export const testFirebaseConnection = async (): Promise<boolean> => {
  try {
    console.log("🧪 Testing Firebase connection...");
    const testData = {
      test: true,
      timestamp: Timestamp.now(),
      message: "Firebase connection test"
    };
    const docRef = await addDoc(collection(db, "test"), testData);
    console.log("✅ Firebase connection test successful! Document ID:", docRef.id);
    return true;
  } catch (error: any) {
    console.error("❌ Firebase connection test failed:", error);
    return false;
  }
};

/**
 * Error log record interface
 */
export interface ErrorLogRecord {
  errorType: string; // e.g., 'PDF_EXTRACTION', 'AI_PARSING', 'FIREBASE_SAVE', etc.
  errorMessage: string;
  errorStack?: string;
  context?: {
    fileName?: string;
    fileSize?: number;
    textLength?: number;
    userId?: string;
    page?: string;
    action?: string;
    [key: string]: any;
  };
  timestamp: Timestamp;
  userAgent?: string;
  url?: string;
}

/**
 * Save error log to Firestore
 */
export const saveErrorLog = async (error: Error | string, context?: {
  errorType?: string;
  fileName?: string;
  fileSize?: number;
  textLength?: number;
  userId?: string;
  page?: string;
  action?: string;
  [key: string]: any;
}): Promise<string | null> => {
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    const errorLog: ErrorLogRecord = {
      errorType: context?.errorType || 'UNKNOWN_ERROR',
      errorMessage: errorMessage,
      errorStack: errorStack,
      context: {
        ...context,
        // Remove errorType from context as it's already a top-level field
        errorType: undefined,
      },
      timestamp: Timestamp.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Remove undefined values from context
    Object.keys(errorLog.context || {}).forEach(key => {
      if (errorLog.context![key] === undefined) {
        delete errorLog.context![key];
      }
    });

    console.log('📝 Saving error log to Firebase...', {
      errorType: errorLog.errorType,
      errorMessage: errorLog.errorMessage.substring(0, 100),
    });

    const docRef = await addDoc(collection(db, "error_logs"), errorLog);
    console.log('✅ Error log saved successfully! Document ID:', docRef.id);
    return docRef.id;
  } catch (saveError: any) {
    console.error('❌ Failed to save error log to Firebase:', saveError);
    // Don't throw - error logging should never break the app
    return null;
  }
};

/**
 * Get all error logs from error_logs collection
 */
export const getErrorLogs = async (): Promise<(ErrorLogRecord & { id: string })[]> => {
  try {
    console.log("🔄 Fetching error logs from Firestore...");
    
    const q = query(collection(db, "error_logs"), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    
    const records: (ErrorLogRecord & { id: string })[] = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() } as ErrorLogRecord & { id: string });
    });
    
    console.log(`✅ Retrieved ${records.length} error logs`);
    return records;
  } catch (error: any) {
    console.error("❌ Error fetching error logs:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    return [];
  }
};

export { db, analytics };
export default app;

