"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayCircle,
  Trophy,
  Star,
  Award,
  Check,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Layout from "@/components/Layout";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Backend API interfaces
interface BackendNominee {
  id: number;
  name: string;
  video_url: string;
  votes?: number;
}

interface BackendCategory {
  category_id: number;
  category_name: string;
  nominees: BackendNominee[];
}

interface BackendSection {
  section_id: number;
  section_name: string;
  categories: BackendCategory[];
}

// Internal interfaces
interface Nominee {
  id: string;
  name: string;
  votes: number;
  videoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  nominees: Nominee[];
}

interface Section {
  id: string;
  name: string;
  categories: Category[];
}

interface UserVote {
  sectionId: string;
  categoryId: string;
  nomineeId: string;
}

interface SubmissionStatus {
  contentCreators: boolean;
  esportsAwards: boolean;
  contentCreatorsDate?: string;
  esportsAwardsDate?: string;
}

// Vote submission payload
interface VoteSubmissionPayload {
  section_id: number;
  votes: {
    category_id: number;
    nominee_id: number;
  }[];
}

export function Awards() {
  const { user, token } = useAuth();

  const [awardsData, setAwardsData] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    contentCreators: false,
    esportsAwards: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transform backend data to internal format
  const transformBackendData = (backendData: BackendSection[]): Section[] => {
    return backendData.map((section) => ({
      id: section.section_id.toString(),
      name: section.section_name,
      categories: section.categories.map((category) => ({
        id: category.category_id.toString(),
        name: category.category_name,
        nominees: category.nominees.map((nominee) => ({
          id: nominee.id.toString(),
          name: nominee.name,
          votes: nominee.votes || 0,
          videoUrl:
            nominee.video_url && nominee.video_url.trim() !== ""
              ? nominee.video_url
              : undefined,
        })),
      })),
    }));
  };

  // Create section tab ID mapping
  const getSectionTabId = (sectionName: string): string => {
    if (sectionName.toLowerCase().includes("content")) {
      return "content-creators";
    } else if (sectionName.toLowerCase().includes("esports")) {
      return "esports-awards";
    }
    return sectionName.toLowerCase().replace(/\s+/g, "-");
  };

  // Load awards data from API
  useEffect(() => {
    const loadAwardsData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/all/`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to load data: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (!Array.isArray(data)) {
          throw new Error("Invalid data format received from API");
        }

        const transformedData = transformBackendData(data);
        setAwardsData(transformedData);

        // Set the first section as active tab
        if (transformedData.length > 0) {
          setActiveTab(getSectionTabId(transformedData[0].name));
        }
      } catch (err) {
        console.error("Error loading awards data:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load awards data"
        );
      } finally {
        setLoading(false);
      }
    };

    loadAwardsData();
  }, []);

  // Load user votes and submission status from localStorage
  useEffect(() => {
    if (awardsData.length === 0) return;

    // Check submission status
    const contentCreatorsSubmitted =
      localStorage.getItem("contentCreatorsSubmitted") === "true";
    const esportsAwardsSubmitted =
      localStorage.getItem("esportsAwardsSubmitted") === "true";
    const contentCreatorsDate = localStorage.getItem(
      "contentCreatorsSubmissionDate"
    );
    const esportsAwardsDate = localStorage.getItem(
      "esportsAwardsSubmissionDate"
    );

    setSubmissionStatus({
      contentCreators: contentCreatorsSubmitted,
      esportsAwards: esportsAwardsSubmitted,
      contentCreatorsDate: contentCreatorsDate || undefined,
      esportsAwardsDate: esportsAwardsDate || undefined,
    });

    // If both sections are submitted, load submitted votes for display
    if (contentCreatorsSubmitted && esportsAwardsSubmitted) {
      const savedSubmittedVotes = localStorage.getItem("submittedUserVotes");
      if (savedSubmittedVotes) {
        try {
          const parsed = JSON.parse(savedSubmittedVotes);
          if (Array.isArray(parsed)) {
            setUserVotes(parsed);
          }
        } catch (e) {
          console.error("Failed to parse submitted user votes:", e);
        }
      }
      return;
    }

    // Load ongoing votes
    const savedUserVotes = localStorage.getItem("userAwardsVotes");
    if (savedUserVotes) {
      try {
        const parsed = JSON.parse(savedUserVotes);
        if (Array.isArray(parsed)) {
          setUserVotes(parsed);
        }
      } catch (e) {
        console.error("Failed to parse user votes:", e);
      }
    }

    // Load and merge saved vote counts
    const savedVotes = localStorage.getItem("awardsVotes");
    if (savedVotes) {
      try {
        const parsed = JSON.parse(savedVotes);
        if (Array.isArray(parsed)) {
          const mergedData = awardsData.map((section) => ({
            ...section,
            categories: section.categories.map((category) => ({
              ...category,
              nominees: category.nominees.map((nominee) => {
                const savedNominee = parsed
                  .find((s: Section) => s.id === section.id)
                  ?.categories.find((c: Category) => c.id === category.id)
                  ?.nominees.find((n: Nominee) => n.id === nominee.id);
                return {
                  ...nominee,
                  votes: savedNominee ? savedNominee.votes : nominee.votes,
                };
              }),
            })),
          }));
          setAwardsData(mergedData);
        }
      } catch (e) {
        console.error("Failed to parse saved votes:", e);
      }
    }
  }, [awardsData.length]);

  // Save user votes to localStorage
  useEffect(() => {
    if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
      localStorage.setItem("userAwardsVotes", JSON.stringify(userVotes));
    }
  }, [userVotes, submissionStatus]);

  // Save vote counts to localStorage
  useEffect(() => {
    if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
      localStorage.setItem("awardsVotes", JSON.stringify(awardsData));
    }
  }, [awardsData, submissionStatus]);

  // Handle voting for a nominee
  const handleVote = (
    sectionId: string,
    categoryId: string,
    nomineeId: string
  ) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const sectionTabId = getSectionTabId(section?.name || "");

    // Check if section is already submitted
    if (
      (sectionTabId === "content-creators" &&
        submissionStatus.contentCreators) ||
      (sectionTabId === "esports-awards" && submissionStatus.esportsAwards)
    ) {
      return;
    }

    // Check if user has already voted in this category
    const existingVote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );

    if (existingVote) {
      if (existingVote.nomineeId === nomineeId) {
        return; // Already voted for this nominee
      }

      // Change vote - remove old vote count
      setAwardsData((prevData) =>
        prevData.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                categories: section.categories.map((category) =>
                  category.id === categoryId
                    ? {
                        ...category,
                        nominees: category.nominees.map((nominee) =>
                          nominee.id === existingVote.nomineeId
                            ? {
                                ...nominee,
                                votes: Math.max(0, nominee.votes - 1),
                              }
                            : nominee
                        ),
                      }
                    : category
                ),
              }
            : section
        )
      );

      // Update user vote
      setUserVotes((prevVotes) =>
        prevVotes.map((vote) =>
          vote.sectionId === sectionId && vote.categoryId === categoryId
            ? { ...vote, nomineeId }
            : vote
        )
      );
    } else {
      // First time voting in this category
      setUserVotes((prevVotes) => [
        ...prevVotes,
        { sectionId, categoryId, nomineeId },
      ]);
    }

    // Add vote count for new nominee
    setAwardsData((prevData) =>
      prevData.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              categories: section.categories.map((category) =>
                category.id === categoryId
                  ? {
                      ...category,
                      nominees: category.nominees.map((nominee) =>
                        nominee.id === nomineeId
                          ? { ...nominee, votes: nominee.votes + 1 }
                          : nominee
                      ),
                    }
                  : category
              ),
            }
          : section
      )
    );
  };

  // Handle undoing a vote
  const handleUndoVote = (sectionId: string, categoryId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const sectionTabId = getSectionTabId(section?.name || "");

    if (
      (sectionTabId === "content-creators" &&
        submissionStatus.contentCreators) ||
      (sectionTabId === "esports-awards" && submissionStatus.esportsAwards)
    ) {
      return;
    }

    const existingVote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );

    if (!existingVote) return;

    // Remove user vote
    setUserVotes((prevVotes) =>
      prevVotes.filter(
        (vote) =>
          !(vote.sectionId === sectionId && vote.categoryId === categoryId)
      )
    );

    // Remove vote count
    setAwardsData((prevData) =>
      prevData.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              categories: section.categories.map((category) =>
                category.id === categoryId
                  ? {
                      ...category,
                      nominees: category.nominees.map((nominee) =>
                        nominee.id === existingVote.nomineeId
                          ? {
                              ...nominee,
                              votes: Math.max(0, nominee.votes - 1),
                            }
                          : nominee
                      ),
                    }
                  : category
              ),
            }
          : section
      )
    );
  };

  // Submit votes for a section
  const handleSubmitSectionVotes = async (sectionId: string) => {
    try {
      setIsSubmitting(true);

      // Check if token is available
      if (!token) {
        toast.error("Authentication token not found. Please log in again.");
        return;
      }

      // Get votes for this section
      const sectionVotes = userVotes.filter(
        (vote) => vote.sectionId === sectionId
      );

      if (sectionVotes.length === 0) {
        toast.error("No votes found for this section");
        return;
      }

      // Prepare payload according to API specification
      const payload: VoteSubmissionPayload = {
        section_id: parseInt(sectionId),
        votes: sectionVotes.map((vote) => ({
          category_id: parseInt(vote.categoryId),
          nominee_id: parseInt(vote.nomineeId),
        })),
      };

      console.log("Submitting votes to API:", payload);

      // Submit to backend using axios with Authorization header
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/awards/votes/submit/`,
        JSON.stringify(payload),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Vote submission successful:", response.data);

      // Update local state after successful submission
      const currentDate = new Date().toISOString();
      const section = awardsData.find((s) => s.id === sectionId);
      const sectionTabId = getSectionTabId(section?.name || "");

      if (sectionTabId === "content-creators") {
        localStorage.setItem("contentCreatorsSubmitted", "true");
        localStorage.setItem("contentCreatorsSubmissionDate", currentDate);
        setSubmissionStatus((prev) => ({
          ...prev,
          contentCreators: true,
          contentCreatorsDate: currentDate,
        }));
      } else if (sectionTabId === "esports-awards") {
        localStorage.setItem("esportsAwardsSubmitted", "true");
        localStorage.setItem("esportsAwardsSubmissionDate", currentDate);
        setSubmissionStatus((prev) => ({
          ...prev,
          esportsAwards: true,
          esportsAwardsDate: currentDate,
        }));
      }

      // Check if both sections are now submitted
      const newContentCreatorsStatus =
        sectionTabId === "content-creators"
          ? true
          : submissionStatus.contentCreators;
      const newEsportsStatus =
        sectionTabId === "esports-awards"
          ? true
          : submissionStatus.esportsAwards;

      if (newContentCreatorsStatus && newEsportsStatus) {
        localStorage.setItem("submittedUserVotes", JSON.stringify(userVotes));
        localStorage.removeItem("userAwardsVotes");
      }

      toast.success("Votes submitted successfully!");
    } catch (error) {
      console.error("Error submitting votes:", error);

      let errorMessage = "Unknown error";
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        } else if (error.response?.status === 403) {
          errorMessage = "You don't have permission to submit votes.";
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else {
          errorMessage = `HTTP error! status: ${error.response?.status}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper functions
  const getUserVoteForCategory = (
    sectionId: string,
    categoryId: string
  ): string | null => {
    const vote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );
    return vote ? vote.nomineeId : null;
  };

  const getSectionVotesCount = (sectionId: string) => {
    return userVotes.filter((vote) => vote.sectionId === sectionId).length;
  };

  const getSectionCategoriesCount = (sectionId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    return section ? section.categories.length : 0;
  };

  const canSubmitSection = (sectionId: string) => {
    const votesCount = getSectionVotesCount(sectionId);
    const categoriesCount = getSectionCategoriesCount(sectionId);
    return votesCount === categoriesCount && votesCount > 0;
  };

  const isSectionSubmitted = (sectionId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const sectionTabId = getSectionTabId(section?.name || "");
    return sectionTabId === "content-creators"
      ? submissionStatus.contentCreators
      : submissionStatus.esportsAwards;
  };

  const getSelectedNomineeName = (
    sectionId: string,
    categoryId: string,
    nomineeId: string
  ) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const category = section?.categories.find((c) => c.id === categoryId);
    const nominee = category?.nominees.find((n) => n.id === nomineeId);
    return nominee?.name || "Unknown";
  };

  const getCategoryName = (sectionId: string, categoryId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const category = section?.categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown Category";
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="text-center p-8">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
              <h2 className="text-xl font-semibold mb-2">Loading Awards...</h2>
              <p className="text-muted-foreground">
                Please wait while we load the awards data.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="text-center p-8">
              <div className="h-12 w-12 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Error Loading Awards
              </h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Completion state - both sections submitted
  if (submissionStatus.contentCreators && submissionStatus.esportsAwards) {
    const contentCreatorVotes = userVotes.filter((vote) => {
      const section = awardsData.find((s) => s.id === vote.sectionId);
      const sectionTabId = getSectionTabId(section?.name || "");
      return sectionTabId === "content-creators";
    });

    const esportsVotes = userVotes.filter((vote) => {
      const section = awardsData.find((s) => s.id === vote.sectionId);
      const sectionTabId = getSectionTabId(section?.name || "");
      return sectionTabId === "esports-awards";
    });

    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <Card className="w-full max-w-4xl mx-auto">
          <CardContent className="text-center p-8">
            <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-primary mb-4">
              All Votes Submitted Successfully!
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              Thank you for participating in the NFCA 2025. Your votes have been
              recorded and will be counted towards the final results.
            </p>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-center">
                    <Star className="h-5 w-5 mr-2 text-yellow-500" />
                    Your Content Creator Votes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {contentCreatorVotes.length > 0 ? (
                    contentCreatorVotes.map((vote) => (
                      <div
                        key={vote.categoryId}
                        className="bg-muted/50 rounded-lg p-3 text-left"
                      >
                        <p className="font-medium text-sm text-primary">
                          {getCategoryName(vote.sectionId, vote.categoryId)}
                        </p>
                        <p className="text-sm text-foreground">
                          {getSelectedNomineeName(
                            vote.sectionId,
                            vote.categoryId,
                            vote.nomineeId
                          )}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No votes found
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-center">
                    <Trophy className="h-5 w-5 mr-2 text-primary" />
                    Your Esports Award Votes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                  {esportsVotes.length > 0 ? (
                    esportsVotes.map((vote) => (
                      <div
                        key={vote.categoryId}
                        className="bg-muted/50 rounded-lg p-3 text-left"
                      >
                        <p className="font-medium text-sm text-primary">
                          {getCategoryName(vote.sectionId, vote.categoryId)}
                        </p>
                        <p className="text-sm text-foreground">
                          {getSelectedNomineeName(
                            vote.sectionId,
                            vote.categoryId,
                            vote.nomineeId
                          )}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No votes found
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Content Creators submitted:</strong>{" "}
                {submissionStatus.contentCreatorsDate
                  ? new Date(
                      submissionStatus.contentCreatorsDate
                    ).toLocaleString()
                  : "Unknown"}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Esports Awards submitted:</strong>{" "}
                {submissionStatus.esportsAwardsDate
                  ? new Date(
                      submissionStatus.esportsAwardsDate
                    ).toLocaleString()
                  : "Unknown"}
              </p>
            </div>

            <Button asChild>
              <Link href="/home">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main voting interface
  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-b">
        <div className="absolute inset-0 bg-[url('/placeholder.svg?height=200&width=1200&text=Awards+Background')] opacity-10"></div>
        <div className="relative container mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-12 w-12 text-primary mr-4" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              NFCA 2025
            </h1>
            <Award className="h-12 w-12 text-primary ml-4" />
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            Nigerian Freefire Community Awards - Celebrating excellence in
            Nigerian content creation and Free Fire esports. Cast your vote for
            the best creators and players!
          </p>

          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-700 font-semibold">
                SSA AWARDS Coming Soon
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              <span>One vote per category</span>
            </div>
            <div className="flex items-center">
              <Trophy className="h-4 w-4 mr-1 text-primary" />
              <span>Winners announced soon</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            {awardsData.map((section) => {
              const tabId = getSectionTabId(section.name);
              return (
                <TabsTrigger
                  key={section.id}
                  value={tabId}
                  className="text-sm md:text-base"
                >
                  {section.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {awardsData.map((section) => {
            const tabId = getSectionTabId(section.name);
            return (
              <TabsContent key={section.id} value={tabId} className="mt-6">
                <div className="mb-6 text-center">
                  <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
                    {section.name}
                  </h2>
                  <p className="text-muted-foreground">
                    {section.categories.length} categories • One vote per
                    category
                  </p>

                  {!isSectionSubmitted(section.id) && (
                    <div className="bg-muted/30 rounded-lg p-4 mt-4 mb-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Voting Progress
                        </h3>
                        <p className="text-muted-foreground">
                          You have voted in {getSectionVotesCount(section.id)}{" "}
                          out of {getSectionCategoriesCount(section.id)}{" "}
                          categories
                        </p>
                      </div>
                      {getSectionVotesCount(section.id) > 0 &&
                        !canSubmitSection(section.id) && (
                          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p className="text-sm text-yellow-800">
                              <strong>Note:</strong> You need to vote in all{" "}
                              {getSectionCategoriesCount(section.id)} categories
                              before you can submit your votes for this section.
                            </p>
                          </div>
                        )}
                    </div>
                  )}

                  {isSectionSubmitted(section.id) && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 mb-6">
                      <div className="flex items-center justify-center mb-2">
                        <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                        <h3 className="text-lg font-semibold text-green-800">
                          Votes Submitted!
                        </h3>
                      </div>
                      <p className="text-sm text-green-700">
                        Your votes for {section.name} have been successfully
                        submitted.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.categories.map((category) => {
                    const userVoteForCategory = getUserVoteForCategory(
                      section.id,
                      category.id
                    );
                    const sectionSubmitted = isSectionSubmitted(section.id);

                    return (
                      <Card
                        key={category.id}
                        className="hover:shadow-lg transition-shadow duration-200"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center">
                              <Award className="h-5 w-5 mr-2 text-primary" />
                              {category.name}
                            </CardTitle>
                            {userVoteForCategory && !sectionSubmitted && (
                              <Button
                                onClick={() =>
                                  handleUndoVote(section.id, category.id)
                                }
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Undo Vote
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {category.nominees.map((nominee) => {
                            const isVoted = userVoteForCategory === nominee.id;
                            return (
                              <div
                                key={nominee.id}
                                className={`flex items-center justify-between rounded-lg p-4 transition-colors duration-200 ${
                                  isVoted
                                    ? "bg-primary/10 border-2 border-primary/30"
                                    : "bg-muted/50 hover:bg-muted/70"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center">
                                    <span className="font-medium text-foreground">
                                      {nominee.name}
                                    </span>
                                    {isVoted && (
                                      <Check className="h-4 w-4 ml-2 text-primary" />
                                    )}
                                  </div>
                                  {nominee.videoUrl && (
                                    <Link
                                      href={nominee.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 text-sm text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors duration-200"
                                    >
                                      <PlayCircle className="h-4 w-4" /> Watch
                                      Video
                                    </Link>
                                  )}
                                </div>
                                <Button
                                  onClick={() =>
                                    handleVote(
                                      section.id,
                                      category.id,
                                      nominee.id
                                    )
                                  }
                                  size="sm"
                                  variant={isVoted ? "secondary" : "default"}
                                  disabled={isVoted || sectionSubmitted}
                                  className={
                                    isVoted
                                      ? "bg-primary/20 text-primary cursor-default"
                                      : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                  }
                                >
                                  {isVoted ? "Voted" : "Vote"}
                                </Button>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {!isSectionSubmitted(section.id) && (
                  <div className="mt-8 text-center">
                    <Button
                      onClick={() => handleSubmitSectionVotes(section.id)}
                      disabled={!canSubmitSection(section.id) || isSubmitting}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Submit All Votes for {section.name}
                        </>
                      )}
                    </Button>
                    {!canSubmitSection(section.id) &&
                      getSectionVotesCount(section.id) > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Vote in all {getSectionCategoriesCount(section.id)}{" "}
                          categories to submit
                        </p>
                      )}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </main>
    </div>
  );
}
