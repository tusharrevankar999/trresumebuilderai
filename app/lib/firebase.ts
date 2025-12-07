// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, Timestamp } from "firebase/firestore";

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
  exportFormat: 'PDF' | 'DOC' | 'PNG' | 'JPG';
  downloadedAt: Timestamp;
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

/**
 * Save resume record to Firestore under users/{email}/cvs collection (data only, no file upload)
 */
export const saveResumeRecord = async (resumeData: ResumeRecord): Promise<string | null> => {
  try {
    // Get user email - use email from resume data or default to 'anonymous'
    const userEmail = resumeData.email || 'anonymous';
    
    console.log("🔄 Attempting to save resume record to Firestore...");
    console.log("📦 Data being saved:", {
      fullName: resumeData.fullName,
      email: userEmail,
      template: resumeData.template,
      exportFormat: resumeData.exportFormat
    });
    
    // Save to nested path: users/{email}/cvs
    const docRef = await addDoc(collection(db, "users", userEmail, "cvs"), resumeData);
    console.log("✅ Resume record saved successfully!");
    console.log("📄 Collection path: users/" + userEmail + "/cvs");
    console.log("🆔 Document ID:", docRef.id);
    console.log("🔗 Full path: users/" + userEmail + "/cvs/" + docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("❌ Error saving resume record to Firestore:");
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Full error:", error);
    
    // Check for common Firestore errors
    if (error?.code === 'permission-denied') {
      console.error("⚠️ Permission denied! Check Firestore security rules.");
    } else if (error?.code === 'unavailable') {
      console.error("⚠️ Firestore service unavailable. Check your internet connection.");
    }
    
    // Don't throw - allow download to continue even if save fails
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

export { db, analytics };
export default app;

