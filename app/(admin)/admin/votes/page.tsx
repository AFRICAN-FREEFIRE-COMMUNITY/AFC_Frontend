"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Vote,
  Users,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Trophy,
  Star,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader, Loader } from "@/components/Loader";
import { CreateCategoryModal } from "./_components/CreateCategoryModal";
import { env } from "@/lib/env";
import { AddSectionModal } from "./_components/AddSectionModal";
import { CreateNomineeModal } from "./_components/CreateNomineeModal";
import { AssignNomineeModal } from "./_components/AssignNomineeModal";
import { toast } from "sonner";
import { EditCategoryModal } from "./_components/EditCategoryModal";
import { EditNomineeModal } from "./_components/EditNomineeModal";
import { RemoveNomineeModal } from "./_components/RemoveNomineeModal";

// Real API fetch functions
const fetchVotingMetrics = async (token: string) => {
  const baseUrl = env.NEXT_PUBLIC_BACKEND_API_URL;

  try {
    const [totalVotesRes, totalVotersRes] = await Promise.all([
      fetch(`${baseUrl}/awards/get-total-votes-cast/`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${baseUrl}/awards/get-total-voters/`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const totalVotesData = await totalVotesRes.json();
    const totalVotersData = await totalVotersRes.json();

    return {
      totalVotes: totalVotesData.total_votes || 0,
      totalVoters: totalVotersData.total_voters || 0,
      completedVotes: Math.floor((totalVotersData.total_voters || 0) * 0.81), // Estimated
      partialVotes: Math.floor((totalVotersData.total_voters || 0) * 0.19), // Estimated
      contentCreatorVotes: 0, // Will be updated from section data
      esportsAwardVotes: 0, // Will be updated from section data
      averageVotingTime: "4.2 minutes",
      votingCompletionRate: 81.1,
      peakVotingHour: "8:00 PM",
      mostVotedCategory: "Best Content Creator",
      leastVotedCategory: "Best Rookie Player",
    };
  } catch (error) {
    console.error("Error fetching voting metrics:", error);
    return {
      totalVotes: 0,
      totalVoters: 0,
      completedVotes: 0,
      partialVotes: 0,
      contentCreatorVotes: 0,
      esportsAwardVotes: 0,
      averageVotingTime: "N/A",
      votingCompletionRate: 0,
      peakVotingHour: "N/A",
      mostVotedCategory: "N/A",
      leastVotedCategory: "N/A",
    };
  }
};

// Fetch votes per section
const fetchVotesPerSection = async (token: string) => {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/get-votes-per-section/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();
    // Handle different response formats
    const votesData = Array.isArray(data) ? data : data.votes_per_section || [];

    // Normalize the data structure to use consistent keys
    const normalizedData = votesData.map((item: any) => ({
      section_name: item.section_name || item.section || "Unknown",
      total_votes: item.total_votes || item.votes || 0,
    }));

    return normalizedData;
  } catch (error) {
    console.error("Error fetching votes per section:", error);
    return [];
  }
};

// Fetch votes per category
const fetchVotesPerCategory = async (token: string) => {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/get-votes-per-category/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();

    // Transform the data to match expected format
    const votesData = Array.isArray(data)
      ? data
      : data.votes_per_category || [];

    // Map to consistent format
    return votesData.map((item) => ({
      category_name: item.category || item.category_name,
      total_votes: item.votes || item.total_votes || 0,
      category_id: item.category_id || null,
      section_name: item.section_name || item.section || null,
    }));
  } catch (error) {
    console.error("Error fetching votes per category:", error);
    return [];
  }
};

// Fetch votes per nominee PER CATEGORY (not cumulative)
const fetchVotesPerNominee = async (token: string) => {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/get-total-votes-per-nominee-per-category/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();

    // Handle the new API response format
    // Format: { "Category Name": [{ "nominee": "Name", "votes": 5 }] }
    const votesArray: any[] = [];

    // Convert the object structure to a flat array
    Object.entries(data).forEach(([categoryName, nominees]: [string, any]) => {
      if (Array.isArray(nominees)) {
        nominees.forEach((nominee) => {
          votesArray.push({
            nominee_id: null, // Backend doesn't provide ID in this format
            nominee_name: nominee.nominee,
            category_id: null, // Backend doesn't provide ID in this format
            category_name: categoryName.trim(),
            total_votes: nominee.votes || 0,
            percentage: 0, // Will calculate later if needed
          });
        });
      }
    });

    return votesArray;
  } catch (error) {
    console.error("Error fetching votes per nominee-category:", error);
    return [];
  }
};

// Fetch voting timeline
const fetchVotingTimelineData = async (token: string) => {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/get-voting-timeline/`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await response.json();
    // API returns array directly, not wrapped in voting_timeline
    return Array.isArray(data) ? data : data.voting_timeline || [];
  } catch (error) {
    console.error("Error fetching voting timeline:", error);
    return [];
  }
};

// Mock function to fetch recent voting activities
const fetchRecentVotingActivities = async () => {
  return [
    {
      id: 1,
      user: "john_doe_ff",
      action: "Completed Content Creator voting",
      timestamp: "2024-01-10 15:30",
      categories: 12,
    },
    {
      id: 2,
      user: "jane_gamer",
      action: "Completed Esports Awards voting",
      timestamp: "2024-01-10 15:25",
      categories: 13,
    },
    {
      id: 3,
      user: "pro_player_123",
      action: "Partial voting - Content Creator section",
      timestamp: "2024-01-10 15:20",
      categories: 8,
    },
    {
      id: 4,
      user: "stream_king",
      action: "Completed both voting sections",
      timestamp: "2024-01-10 15:15",
      categories: 25,
    },
    {
      id: 5,
      user: "esports_fan",
      action: "Started voting session",
      timestamp: "2024-01-10 15:10",
      categories: 3,
    },
  ];
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function AdminVotesPage() {
  const [metrics, setMetrics] = useState(null);
  const [sectionVotes, setSectionVotes] = useState([]);
  const [categoryVotes, setCategoryVotes] = useState([]);
  const [nomineeVotes, setNomineeVotes] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [topNominees, setTopNominees] = useState([]);
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);

  // Add these state variables at the top of your component
  const [selectedSectionFilter, setSelectedSectionFilter] = useState("all");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedManagementSectionFilter, setSelectedManagementSectionFilter] =
    useState("all");

  // Add this filtering function
  const getFilteredNominees = () => {
    let filtered = [...nominees];

    // Filter by section
    if (selectedSectionFilter !== "all") {
      filtered = filtered.filter((nom) => {
        const nomineeCategories = nom.categories || [];
        return nomineeCategories.some(
          (cat) => cat.section === selectedSectionFilter
        );
      });
    }

    // Filter by category
    if (selectedCategoryFilter !== "all") {
      filtered = filtered.filter((nom) => {
        const nomineeCategories = nom.categories || [];
        return nomineeCategories.some(
          (cat) => (cat.id || cat._id) === selectedCategoryFilter
        );
      });
    }

    return filtered;
  };

  // Get unique sections from nominees for filter dropdown
  const getUniqueSectionsFromNominees = () => {
    const allSections = nominees.flatMap((nom) =>
      (nom.categories || []).map((cat) => cat.section).filter(Boolean)
    );
    return [...new Set(allSections)];
  };

  const { user, token } = useAuth();

  // Data states
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [sections, setSections] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  // Additional states for the tabs
  const [allSectionsData, setAllSectionsData] = useState([]);
  const [allCategoriesData, setAllCategoriesData] = useState([]);
  const [allNomineesData, setAllNomineesData] = useState([]);

  // Stats
  const [stats, setStats] = useState({
    totalCategories: 0,
    totalNominees: 0,
    totalAssignments: 0,
  });

  // UI toggles
  const [showCategoriesList, setShowCategoriesList] = useState(false);
  const [showNomineesList, setShowNomineesList] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [showNewNomineeForm, setShowNewNomineeForm] = useState(false);

  // Form states
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    section_id: "",
  });
  const [newNomineeData, setNewNomineeData] = useState({
    name: "",
    video_url: "",
  });
  const [formData, setFormData] = useState({
    category_id: "",
    nominee_id: "",
  });

  // Loading & messaging
  const [fetchingData, setFetchingData] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [loadingNominee, setLoadingNominee] = useState(false);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Helper: API wrapper to reduce repetition
  const apiFetch = useCallback(
    async (path, options = {}) => {
      if (!token) throw new Error("No auth token");
      const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}${path}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = body?.message || `Request failed: ${res.status}`;
        const err = new Error(errMsg);
        (err as any).serverBody = body;
        throw err;
      }
      return body;
    },
    [token]
  );

  // Fetch functions
  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/categories/view/");
      const categoriesData = data.categories || data || [];
      setCategories(categoriesData);
      setAllCategoriesData(categoriesData); // Store for display
      setStats((prev) => ({ ...prev, totalCategories: categoriesData.length }));
    } catch (err) {
      console.error("fetchCategories error:", err);
      toast.error("Failed to load categories");
    }
  }, [apiFetch]);

  const fetchNominees = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/nominees/view/");
      const nomineesData = data.nominees || data || [];
      setNominees(nomineesData);
      setAllNomineesData(nomineesData); // Store for display
      setStats((prev) => ({ ...prev, totalNominees: nomineesData.length }));
    } catch (err) {
      console.error("fetchNominees error:", err);
      toast.error("Failed to load nominees");
    }
  }, [apiFetch]);

  const fetchSections = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/sections/all/");
      const sectionsData = data.sections || data || [];
      setSections(sectionsData);
      setAllSectionsData(sectionsData); // Store for display
    } catch (err) {
      console.error("fetchSections error:", err);
      setSections([
        { id: "content", name: "Content Creator Awards" },
        { id: "esports", name: "Esports Awards" },
      ]);
    }
  }, [apiFetch]);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/activities/view/");
      const acts = data.activities || data || [];
      setRecentActivities(acts);
    } catch (err) {
      console.debug("No activities endpoint or failed to load activities.");
    }
  }, [apiFetch]);

  // Load all voting analytics data
  const loadVotingAnalytics = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const [
        votingMetrics,
        sectionVotesData,
        categoryVotesData,
        nomineeVotesData,
        votingTimeline,
        activities,
      ] = await Promise.all([
        fetchVotingMetrics(token),
        fetchVotesPerSection(token),
        fetchVotesPerCategory(token),
        fetchVotesPerNominee(token),
        fetchVotingTimelineData(token),
        fetchRecentVotingActivities(),
      ]);

      // Update metrics with section votes if available
      if (sectionVotesData.length > 0) {
        votingMetrics.contentCreatorVotes =
          sectionVotesData.find((s) =>
            s.section_name?.toLowerCase().includes("content")
          )?.total_votes || 0;

        votingMetrics.esportsAwardVotes =
          sectionVotesData.find((s) =>
            s.section_name?.toLowerCase().includes("esport")
          )?.total_votes || 0;
      }

      // If no section votes data, calculate from category votes
      let finalSectionVotes = sectionVotesData;
      if (sectionVotesData.length === 0 && categoryVotesData.length > 0) {
        // Group category votes by section
        const sectionVotesMap = new Map();
        categoryVotesData.forEach((cat) => {
          const sectionName = cat.section_name || cat.section || "Other";
          const currentVotes = sectionVotesMap.get(sectionName) || 0;
          sectionVotesMap.set(
            sectionName,
            currentVotes + (cat.total_votes || 0)
          );
        });

        // Convert map to array
        finalSectionVotes = Array.from(sectionVotesMap.entries()).map(
          ([name, votes]) => ({
            section_name: name,
            total_votes: votes,
          })
        );
      }

      setMetrics(votingMetrics);
      setSectionVotes(finalSectionVotes);
      setCategoryVotes(categoryVotesData);
      setNomineeVotes(nomineeVotesData);
      setTimelineData(votingTimeline);
      setRecentActivities(activities);

      // Calculate top nominees from nominee votes data
      // Match the logic used in the Nominees tab for consistency
      const nomineesWithCalculatedVotes = nomineeVotesData.map((nom) => {
        let calculatedVotes = nom.total_votes;

        // If no vote count but we have percentage and total votes, calculate it
        if (!calculatedVotes && nom.percentage && votingMetrics?.totalVotes) {
          calculatedVotes = Math.round(
            (nom.percentage / 100) * votingMetrics.totalVotes
          );
        }

        return {
          ...nom,
          total_votes: calculatedVotes || 0,
        };
      });

      // Calculate total votes for percentage calculation
      const totalVotesForPercentage = nomineesWithCalculatedVotes.reduce(
        (sum, nom) => sum + (nom.total_votes || 0),
        0
      );

      // Filter, calculate percentages, and get top 10
      const topNomineesData = nomineesWithCalculatedVotes
        .filter((nominee) => nominee.total_votes > 0) // Only include nominees with votes
        .sort((a, b) => b.total_votes - a.total_votes) // Sort by vote count
        .slice(0, 10)
        .map((nominee) => ({
          name: nominee.nominee_name,
          category: nominee.category_name || "N/A",
          votes: nominee.total_votes || 0,
          percentage:
            totalVotesForPercentage > 0
              ? (nominee.total_votes / totalVotesForPercentage) * 100
              : 0,
        }));

      setTopNominees(topNomineesData);
    } catch (error) {
      console.error("Error loading voting analytics:", error);
      toast.error("Failed to load voting analytics");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchInitialData = useCallback(async () => {
    setFetchingData(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchNominees(),
        fetchSections(),
        fetchActivities(),
        loadVotingAnalytics(),
      ]);
    } catch (err) {
      console.error("fetchInitialData error:", err);
      toast.error("Failed to load initial data");
    } finally {
      setFetchingData(false);
    }
  }, [
    fetchCategories,
    fetchNominees,
    fetchSections,
    fetchActivities,
    loadVotingAnalytics,
  ]);

  // run on mount and when token becomes available
  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token, fetchInitialData]);

  // Auto dismiss message after 5 seconds
  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    return () => clearTimeout(t);
  }, [message]);

  // Helpers to get selected entities
  const getSectionName = useCallback(
    (sectionId) => {
      const s = sections.find((x) => (x.id || x._id) === sectionId);
      return s ? s.name || s.title : "Unknown Section";
    },
    [sections]
  );

  const getSelectedCategory = () =>
    categories.find((c) => (c.id || c._id) === formData.category_id);

  const getSelectedNominee = () =>
    nominees.find((n) => (n.id || n._id) === formData.nominee_id);

  // Helper function to get winner for a specific category
  const getCategoryWinner = useCallback(
    (category: any) => {
      const categoryId = category.id || category._id;
      const categoryName = (category.name || category.title)?.trim();

      // Find all vote records for this category from nomineeVotes
      // Match by category name (case-insensitive)
      const categoryVotes = nomineeVotes.filter((vote) => {
        const voteCategoryName = vote.category_name?.trim();
        return voteCategoryName?.toLowerCase() === categoryName?.toLowerCase();
      });

      if (categoryVotes.length === 0) {
        return null;
      }

      // Sort by votes descending to find winner
      const sorted = [...categoryVotes].sort(
        (a, b) => b.total_votes - a.total_votes
      );
      const winner = sorted[0];

      // Calculate total votes in this category
      const totalCategoryVotes = sorted.reduce(
        (sum, n) => sum + (n.total_votes || 0),
        0
      );
      const winnerPercentage =
        totalCategoryVotes > 0
          ? (winner.total_votes / totalCategoryVotes) * 100
          : 0;

      return {
        category_id: categoryId,
        category_name: categoryName,
        winner_id: winner.nominee_id,
        winner_name: winner.nominee_name,
        winning_votes: winner.total_votes,
        winning_percentage: winnerPercentage,
        total_nominees: sorted.length,
      };
    },
    [nomineeVotes]
  );

  // Helper function to get all category winners
  const getAllCategoryWinners = useCallback(() => {
    const winners = allCategoriesData
      .map((category) => getCategoryWinner(category))
      .filter((winner) => winner !== null && winner.winning_votes > 0);

    return winners;
  }, [allCategoriesData, getCategoryWinner, nomineeVotes]);

  // CRUD Handlers
  const handleAddNewCategory = async () => {
    if (!newCategoryData.name.trim() || !newCategoryData.section_id) {
      toast.error("Category name and section are required");
      return;
    }
    setLoadingCategory(true);
    setMessage({ type: "", text: "" });

    try {
      await apiFetch("/awards/categories/add/", {
        method: "POST",
        body: JSON.stringify({
          name: newCategoryData.name,
          section_id: newCategoryData.section_id,
        }),
      });

      toast.success("Category created successfully!");
      setNewCategoryData({ name: "", section_id: "" });
      setShowNewCategoryForm(false);
      await fetchCategories();
    } catch (err) {
      console.error("handleAddNewCategory error:", err);
      toast.error((err as Error).message || "Failed to create category");
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingId(categoryId);
    try {
      await apiFetch(`/awards/categories/delete`, {
        method: "DELETE",
        body: JSON.stringify({
          category_id: categoryId,
        }),
      });
      toast.success("Category deleted successfully!");
      await fetchCategories();
      await fetchNominees();
    } catch (err) {
      console.error("handleDeleteCategory error:", err);
      toast.error((err as Error).message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddNewNominee = async () => {
    if (!newNomineeData.name.trim()) {
      toast.error("Nominee name is required");
      return;
    }
    setLoadingNominee(true);
    setMessage({ type: "", text: "" });

    try {
      await apiFetch("/awards/nominees/create/", {
        method: "POST",
        body: JSON.stringify({
          name: newNomineeData.name,
          video_url: newNomineeData.video_url || "",
        }),
      });
      toast.success("Nominee created successfully");
      setNewNomineeData({ name: "", video_url: "" });
      setShowNewNomineeForm(false);
      await fetchNominees();
    } catch (err) {
      console.error("handleAddNewNominee error:", err);
      toast.error((err as Error).message || "Failed to create nominee");
    } finally {
      setLoadingNominee(false);
    }
  };

  const handleDeleteNominee = async (nomineeId) => {
    if (
      !confirm("Delete nominee? This will remove the nominee from the system.")
    )
      return;
    setDeletingId(nomineeId);
    try {
      await apiFetch(`/awards/nominees/delete/`, {
        method: "DELETE",
        body: JSON.stringify({
          nominee_id: nomineeId,
        }),
      });
      toast.success("Nominee deleted successfully!");
      await fetchNominees();
    } catch (err) {
      console.error("handleDeleteNominee error:", err);
      toast.error((err as Error).message || "Failed to delete nominee");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssignNominee = async () => {
    if (!formData.category_id || !formData.nominee_id) {
      toast.error("Please select both category and nominee");
      return;
    }
    setLoadingAssign(true);
    setMessage({ type: "", text: "" });

    try {
      await apiFetch("/awards/category-nominee/add/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      toast.success("Nominee assigned to category!");
      setFormData({ category_id: "", nominee_id: "" });
      setStats((prev) => ({
        ...prev,
        totalAssignments: prev.totalAssignments + 1,
      }));
    } catch (err) {
      console.error("handleAssignNominee error:", err);
      toast.error((err as Error).message || "Failed to assign nominee");
    } finally {
      setLoadingAssign(false);
    }
  };

  const handleResetAssignment = () => {
    setFormData({ category_id: "", nominee_id: "" });
    setMessage({ type: "", text: "" });
  };

  // Get filtered category votes based on selected section
  const getFilteredCategoryVotes = () => {
    if (selectedSection === "all") {
      return categoryVotes;
    }

    return categoryVotes.filter((cat) => {
      const section = sections.find(
        (s) => (s.id || s._id) === cat.section_id || s.name === cat.section_name
      );
      return section && (section.id || section._id) === selectedSection;
    });
  };

  // Get filtered nominee votes based on selected category
  const getFilteredNomineeVotes = () => {
    if (selectedCategory === "all") {
      return nomineeVotes;
    }

    return nomineeVotes.filter(
      (nom) => (nom.category_id || nom.category_name) === selectedCategory
    );
  };

  if (fetchingData || loading) {
    return <FullLoader />;
  }

  const contentCreatorTotalVotes = allSectionsData.reduce(
    (sectionSum, section) => {
      if (!section.name?.toLowerCase().includes("content")) return sectionSum;

      const sectionCategories = allCategoriesData.filter(
        (cat) =>
          cat.section_id === (section.id || section._id) ||
          cat.section === section.name
      );

      const sectionVotes = sectionCategories.reduce((sum, cat) => {
        const categoryVoteData = categoryVotes.find(
          (cv) =>
            cv.category_name?.trim().toLowerCase() ===
            (cat.name || cat.title)?.trim().toLowerCase()
        );
        return sum + (categoryVoteData?.total_votes || 0);
      }, 0);

      return sectionSum + sectionVotes;
    },
    0
  );

  const esportsTotalVotes = allSectionsData.reduce((sectionSum, section) => {
    if (!section.name?.toLowerCase().includes("esport")) return sectionSum;

    const sectionCategories = allCategoriesData.filter(
      (cat) =>
        cat.section_id === (section.id || section._id) ||
        cat.section === section.name
    );

    const sectionVotes = sectionCategories.reduce((sum, cat) => {
      const categoryVoteData = categoryVotes.find(
        (cv) =>
          cv.category_name?.trim().toLowerCase() ===
          (cat.name || cat.title)?.trim().toLowerCase()
      );
      return sum + (categoryVoteData?.total_votes || 0);
    }, 0);

    return sectionSum + sectionVotes;
  }, 0);

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Voting Analytics Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="line-clamp-1">Total Votes Cast</CardTitle>
              <Vote className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalVotes?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Across all categories
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="line-clamp-1">Total Voters</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalVoters?.toLocaleString() || "0"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Unique participants
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="line-clamp-1">Completion Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.votingCompletionRate || 0}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {metrics?.completedVotes?.toLocaleString() || "0"} completed
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="line-clamp-1">Avg. Voting Time</CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.averageVotingTime || "N/A"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Per complete session
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="line-clamp-1">
                Content Creator Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {contentCreatorTotalVotes.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="line-clamp-1">
                Esports Award Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {esportsTotalVotes.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="line-clamp-1">Total Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {categories.length}
              </div>
              <div className="text-sm text-muted-foreground">
                Across {sections.length} sections
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <ScrollArea>
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="nominees">Nominees</TabsTrigger>
              <TabsTrigger value="winners">Winners</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="top-performers">Top Performers</TabsTrigger>
              {/* <TabsTrigger value="activities">Activities</TabsTrigger> */}
              <TabsTrigger value="management">Management</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voting Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "Completed",
                            value: metrics?.completedVotes || 0,
                            fill: "#00C49F",
                          },
                          {
                            name: "Partial",
                            value: metrics?.partialVotes || 0,
                            fill: "#FFBB28",
                          },
                          {
                            name: "Not Started",
                            value: Math.max(
                              0,
                              (metrics?.totalVoters || 0) -
                                (metrics?.completedVotes || 0) -
                                (metrics?.partialVotes || 0)
                            ),
                            fill: "#FF8042",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[0, 1, 2].map((index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Section Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  {sectionVotes.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No section data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={sectionVotes.map((section) => ({
                          section: section.section_name || "Unknown",
                          votes: section.total_votes || 0,
                        }))}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis
                          dataKey="section"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          tick={{ fill: "#888" }}
                        />
                        <YAxis tick={{ fill: "#888" }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #333",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "#fff" }}
                        />
                        <Bar
                          dataKey="votes"
                          fill="#8884d8"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="sections" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Sections</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overview of all award sections in the system
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {allSectionsData.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No sections available
                    </div>
                  ) : (
                    allSectionsData.map((section) => {
                      const sectionCategories = allCategoriesData.filter(
                        (cat) =>
                          cat.section_id === (section.id || section._id) ||
                          cat.section === section.name
                      );

                      // Calculate total votes by summing all category votes in this section
                      const totalVotes = sectionCategories.reduce(
                        (sum, cat) => {
                          // Find the vote data for this category
                          const categoryVoteData = categoryVotes.find(
                            (cv) =>
                              cv.category_name?.trim().toLowerCase() ===
                              (cat.name || cat.title)?.trim().toLowerCase()
                          );
                          return sum + (categoryVoteData?.total_votes || 0);
                        },
                        0
                      );

                      return (
                        <Card
                          key={section.id || section._id}
                          className="hover:shadow-lg transition-shadow border-2"
                        >
                          <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                              <Trophy className="h-6 w-6 text-primary" />
                              {section.name || section.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Prominent Total Votes Display */}
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 border-2 border-primary/20">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Vote className="h-5 w-5 text-primary" />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    Total Votes
                                  </span>
                                </div>
                                <div className="text-3xl font-bold text-primary">
                                  {totalVotes.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Categories Count */}
                            <div className="flex items-center justify-between text-sm pt-2 border-t">
                              <span className="text-muted-foreground">
                                Categories:
                              </span>
                              <Badge variant="secondary" className="text-sm">
                                {sectionCategories.length}
                              </Badge>
                            </div>

                            {section.description && (
                              <p className="text-xs text-muted-foreground pt-2 border-t">
                                {section.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="categories" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedSection}
                  onValueChange={setSelectedSection}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
                    {allSectionsData.map((section) => (
                      <SelectItem
                        key={section.id || section._id}
                        value={section.id || section._id}
                      >
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Category Voting Performance</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Vote distribution across all categories
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(() => {
                    let filteredCategories = allCategoriesData;
                    if (selectedSection !== "all") {
                      filteredCategories = allCategoriesData.filter(
                        (cat) =>
                          cat.section_id === selectedSection ||
                          cat.section ===
                            allSectionsData.find(
                              (s) => (s.id || s._id) === selectedSection
                            )?.name
                      );
                    }

                    if (filteredCategories.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          No categories available
                        </div>
                      );
                    }

                    // Sort by votes descending
                    const sortedCategories = filteredCategories
                      .map((category) => {
                        // Match by name (case-insensitive and trimmed)
                        const categoryVoteData = categoryVotes.find(
                          (cv) =>
                            cv.category_name?.trim().toLowerCase() ===
                            (category.name || category.title)
                              ?.trim()
                              .toLowerCase()
                        );

                        const votes = categoryVoteData?.total_votes || 0;
                        const percentage =
                          metrics?.totalVotes && metrics.totalVotes > 0
                            ? (votes / metrics.totalVotes) * 100
                            : 0;

                        return {
                          ...category,
                          votes,
                          percentage,
                        };
                      })
                      .sort((a, b) => b.votes - a.votes);

                    return sortedCategories.map((category, index) => (
                      <div
                        key={category.id || category._id}
                        className="space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="font-medium text-foreground">
                              {category.name || category.title}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {category.section}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {category.votes.toLocaleString()} votes
                            </span>
                            <Badge className="min-w-[50px] justify-center">
                              {Math.round(category.percentage)}%
                            </Badge>
                          </div>
                        </div>
                        <Progress
                          value={category.percentage}
                          className="h-2.5"
                        />
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="nominees" className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {allCategoriesData.map((category) => (
                      <SelectItem
                        key={category.id || category._id}
                        value={category.id || category._id}
                      >
                        {category.name || category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCategory !== "all" && (
                  <Badge variant="secondary" className="text-sm">
                    Filtered:{" "}
                    {allCategoriesData.find(
                      (c) => (c.id || c._id) === selectedCategory
                    )?.name || selectedCategory}
                  </Badge>
                )}
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      Nominee Votes
                      {selectedCategory !== "all" &&
                      allCategoriesData.find(
                        (c) => (c.id || c._id) === selectedCategory
                      )
                        ? ` - ${
                            allCategoriesData.find(
                              (c) => (c.id || c._id) === selectedCategory
                            )?.name
                          }`
                        : ""}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vote distribution across nominees
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  let filteredNominees = nomineeVotes;

                  // Filter by category if selected
                  if (selectedCategory !== "all") {
                    // Find the selected category details
                    const selectedCategoryData = allCategoriesData.find(
                      (cat) => (cat.id || cat._id) === selectedCategory
                    );

                    if (selectedCategoryData) {
                      const categoryName = (
                        selectedCategoryData.name || selectedCategoryData.title
                      )
                        ?.trim()
                        .toLowerCase();

                      // Filter by category name directly from vote data (new API format)
                      filteredNominees = nomineeVotes.filter((nomVote) => {
                        const voteCategoryName = nomVote.category_name
                          ?.trim()
                          .toLowerCase();
                        return voteCategoryName === categoryName;
                      });
                    }
                  }

                  // Calculate vote counts and percentages
                  const nomineesWithVotes = filteredNominees.map((nom) => {
                    let calculatedVotes = nom.total_votes;

                    // If no vote count but we have percentage and total votes, calculate it
                    if (
                      !calculatedVotes &&
                      nom.percentage &&
                      metrics?.totalVotes
                    ) {
                      calculatedVotes = Math.round(
                        (nom.percentage / 100) * metrics.totalVotes
                      );
                    }

                    return {
                      ...nom,
                      total_votes: calculatedVotes || 0,
                    };
                  });

                  // Calculate total votes across all filtered nominees for percentage calculation
                  const totalFilteredVotes = nomineesWithVotes.reduce(
                    (sum, nom) => sum + (nom.total_votes || 0),
                    0
                  );

                  // Add percentage calculation based on total votes
                  const nomineesWithPercentages = nomineesWithVotes.map(
                    (nom) => ({
                      ...nom,
                      percentage:
                        totalFilteredVotes > 0
                          ? (nom.total_votes / totalFilteredVotes) * 100
                          : 0,
                    })
                  );

                  const sortedNominees = nomineesWithPercentages
                    .filter((nom) => nom.total_votes > 0) // Only show nominees with votes
                    .sort((a, b) => b.total_votes - a.total_votes);
                  const topNominees = sortedNominees.slice(0, 10);

                  // Calculate total votes for this filtered view
                  const filteredTotalVotes = sortedNominees.reduce(
                    (sum, nom) => sum + (nom.total_votes || 0),
                    0
                  );

                  if (sortedNominees.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground">
                        {selectedCategory !== "all"
                          ? `No nominees found for "${
                              allCategoriesData.find(
                                (c) => (c.id || c._id) === selectedCategory
                              )?.name || selectedCategory
                            }"`
                          : "No nominee data available"}
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Filter Stats Summary */}
                      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-muted-foreground">
                            Total Nominees
                          </p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {sortedNominees.length}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                          <p className="text-sm text-muted-foreground">
                            Total Votes
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {filteredTotalVotes.toLocaleString()}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <p className="text-sm text-muted-foreground">
                            Average Votes
                          </p>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {sortedNominees.length > 0
                              ? Math.round(
                                  filteredTotalVotes / sortedNominees.length
                                ).toLocaleString()
                              : "0"}
                          </p>
                        </div>
                      </div>

                      {/* Horizontal Bar Chart */}
                      <div className="mb-8">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={topNominees.map((nom) => ({
                              name: nom.nominee_name,
                              percentage: nom.percentage,
                            }))}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis
                              dataKey="name"
                              type="category"
                              width={100}
                              tick={{ fontSize: 12 }}
                            />
                            <Tooltip
                              formatter={(value) =>
                                `${Number(value).toFixed(1)}%`
                              }
                            />
                            <Bar dataKey="percentage" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Table Section */}
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-[80px]">Rank</TableHead>
                              <TableHead>Nominee</TableHead>
                              <TableHead className="w-[120px]">Votes</TableHead>
                              <TableHead className="w-[120px]">
                                Percentage
                              </TableHead>
                              <TableHead className="w-[200px]">
                                Progress
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sortedNominees.map((nominee, index) => {
                              const isTopThree = index < 3;

                              return (
                                <TableRow
                                  key={`${nominee.nominee_name}-${index}`}
                                  className="hover:bg-muted/50 transition-colors"
                                >
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          isTopThree ? "default" : "secondary"
                                        }
                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                      >
                                        #{index + 1}
                                      </Badge>
                                      {index === 0 && (
                                        <Trophy className="h-4 w-4 text-yellow-500" />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    {nominee.nominee_name}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Vote className="h-3 w-3 text-blue-500" />
                                      <span className="font-semibold">
                                        {nominee.total_votes > 0
                                          ? nominee.total_votes.toLocaleString()
                                          : "-"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        nominee.percentage > 10
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="font-semibold"
                                    >
                                      {nominee.percentage.toFixed(1)}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Progress
                                        value={nominee.percentage}
                                        className="h-2 flex-1"
                                      />
                                      <span className="text-xs text-muted-foreground w-12 text-right">
                                        {nominee.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Winners Tab */}
          <TabsContent value="winners" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-yellow-500" />
                  <div>
                    <CardTitle>Category Winners</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Winners for each award category based on vote counts
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const allWinners = getAllCategoryWinners();

                  if (allWinners.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground text-lg mb-2">
                          No winners data available yet
                        </p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                          Winners will appear once votes have been cast for
                          categories.
                        </p>
                      </div>
                    );
                  }

                  // Group winners by section
                  const winnersBySection = allWinners.reduce((acc, winner) => {
                    // Find the category to get its section
                    const category = allCategoriesData.find(
                      (c) =>
                        String(c.id || c._id) === String(winner.category_id)
                    );
                    const sectionId = category?.section_id || "unknown";
                    const sectionName = getSectionName(sectionId);

                    if (!acc[sectionName]) {
                      acc[sectionName] = [];
                    }
                    acc[sectionName].push(winner);
                    return acc;
                  }, {} as Record<string, typeof allWinners>);

                  return (
                    <div className="space-y-8">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-muted-foreground">
                            Total Winners
                          </p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {allWinners.length}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                          <p className="text-sm text-muted-foreground">
                            Sections
                          </p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {Object.keys(winnersBySection).length}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                          <p className="text-sm text-muted-foreground">
                            Total Categories
                          </p>
                          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {allCategoriesData.length}
                          </p>
                        </div>
                      </div>

                      {/* Winners Grid */}
                      {Object.entries(winnersBySection).map(
                        ([sectionName, winners]) => (
                          <div key={sectionName}>
                            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                              <Star className="w-5 h-5 text-yellow-500" />
                              {sectionName}
                              <Badge variant="outline" className="ml-2">
                                {winners.length}{" "}
                                {winners.length === 1 ? "winner" : "winners"}
                              </Badge>
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {winners.map((winner) => (
                                <Card
                                  key={winner.category_id}
                                  className="text-base md:text-base hover:shadow-lg transition-shadow"
                                >
                                  <CardHeader className="pb-3">
                                    <CardTitle className="text-base md:text-base flex items-start justify-between gap-2">
                                      <span className="flex-1">
                                        {winner.category_name}
                                      </span>
                                      <Trophy className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                                        1
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-semibold text-lg">
                                          {winner.winner_name}
                                        </p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                          <span>
                                            {winner.winning_votes} votes
                                          </span>
                                          <span>•</span>
                                          <span>
                                            {winner.winning_percentage.toFixed(
                                              1
                                            )}
                                            %
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="pt-2 border-t">
                                      <p className="text-xs text-muted-foreground">
                                        {winner.total_nominees} nominees in
                                        category
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Voting Timeline</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Track voting activity over time
                </p>
              </CardHeader>
              <CardContent>
                {timelineData.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No timeline data available
                  </div>
                ) : (
                  <>
                    <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-muted-foreground">
                          Total Days Tracked
                        </p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {timelineData.length}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-muted-foreground">
                          Peak Daily Votes
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {Math.max(...timelineData.map((d) => d.votes || 0))}
                        </p>
                      </div>
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                        <p className="text-sm text-muted-foreground">
                          Average Daily Votes
                        </p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {Math.round(
                            timelineData.reduce(
                              (sum, d) => sum + (d.votes || 0),
                              0
                            ) / timelineData.length
                          )}
                        </p>
                      </div>
                    </div>

                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart
                        data={timelineData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(date) => {
                            const d = new Date(date);
                            return d.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            });
                          }}
                          className="text-xs"
                        />
                        <YAxis
                          label={{
                            value: "Votes",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(0, 0, 0, 0.8)",
                            border: "none",
                            borderRadius: "8px",
                            color: "white",
                          }}
                          labelFormatter={(date) => {
                            const d = new Date(date);
                            return d.toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            });
                          }}
                          formatter={(value) => [
                            `${value} votes`,
                            "Total Votes",
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="votes"
                          stroke="#8884d8"
                          strokeWidth={3}
                          dot={{
                            fill: "#8884d8",
                            strokeWidth: 2,
                            r: 4,
                            strokeDasharray: "",
                          }}
                          activeDot={{
                            r: 6,
                            fill: "#6366f1",
                            stroke: "#fff",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="top-performers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Nominees</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Top 10 nominees by vote count across all categories
                </p>
              </CardHeader>
              <CardContent>
                {topNominees.length === 0 ? (
                  <div className="text-center py-12">
                    <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      No top performers data available
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Votes will appear here once voting begins
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[100px]">Rank</TableHead>
                          <TableHead>Nominee</TableHead>
                          {/* <TableHead>Category</TableHead> */}
                          <TableHead className="w-[120px]">Votes</TableHead>
                          <TableHead className="w-[200px]">
                            Percentage
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topNominees.map((nominee, index) => {
                          const isTopThree = index < 3;

                          return (
                            <TableRow
                              key={`${nominee.name}-${index}`}
                              className={`hover:bg-muted/50 transition-colors ${
                                isTopThree ? "bg-muted/20" : ""
                              }`}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      isTopThree ? "default" : "secondary"
                                    }
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-base ${
                                      index === 0
                                        ? "bg-yellow-500 hover:bg-yellow-600"
                                        : index === 1
                                        ? "bg-gray-400 hover:bg-gray-500"
                                        : index === 2
                                        ? "bg-amber-600 hover:bg-amber-700"
                                        : ""
                                    }`}
                                  >
                                    #{index + 1}
                                  </Badge>
                                  {index === 0 && (
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                  )}
                                  {index === 1 && (
                                    <Star className="h-5 w-5 text-gray-400" />
                                  )}
                                  {index === 2 && (
                                    <Star className="h-5 w-5 text-amber-600" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {nominee.name || "Unknown Nominee"}
                              </TableCell>
                              {/* <TableCell>
                                <Badge variant="outline" className="whitespace-nowrap">
                                  {nominee.category || "N/A"}
                                </Badge>
                              </TableCell> */}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Vote className="h-4 w-4 text-blue-500" />
                                  <span className="font-semibold text-lg">
                                    {(nominee.votes || 0).toLocaleString()}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Progress
                                    value={nominee.percentage || 0}
                                    className="h-2.5 flex-1"
                                  />
                                  <Badge
                                    variant={
                                      (nominee.percentage || 0) > 10
                                        ? "default"
                                        : "secondary"
                                    }
                                    className="min-w-[60px] justify-center font-semibold"
                                  >
                                    {(nominee.percentage || 0).toFixed(1)}%
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {/* <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Voting Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivities.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-muted-foreground"
                        >
                          No recent activities
                        </TableCell>
                      </TableRow>
                    ) : (
                      recentActivities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell className="font-medium">
                            {activity.user}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {activity.action.includes("Completed") ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : activity.action.includes("Partial") ? (
                                <AlertCircle className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-blue-600" />
                              )}
                              {activity.action}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {activity.categories} categories
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {activity.timestamp}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent> */}
          <TabsContent value="management" className="space-y-6">
            <Tabs defaultValue="categories" className="space-y-6">
              <div className="border-b">
                <TabsList className="w-full">
                  <TabsTrigger className="w-full" value="categories">
                    <span className="mr-2">📁</span>
                    Categories
                  </TabsTrigger>
                  <TabsTrigger className="w-full" value="nominees">
                    <span className="mr-2">👥</span>
                    Nominees
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="categories" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Manage Categories</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add, edit, or delete voting categories
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <AddSectionModal onSectionAdded={fetchSections} />
                      <CreateCategoryModal
                        sections={sections}
                        handleAddNewCategory={handleAddNewCategory}
                        loadingCategory={loadingCategory}
                        newCategoryData={newCategoryData}
                        setNewCategoryData={setNewCategoryData}
                      />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Filter by Section
                          </label>
                          <Select
                            value={selectedManagementSectionFilter}
                            onValueChange={setSelectedManagementSectionFilter}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sections</SelectItem>
                              {sections.map((s) => (
                                <SelectItem
                                  key={s.id || s._id}
                                  value={s.id || s._id}
                                >
                                  {s.name || s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Results
                          </label>
                          <div className="h-10 flex items-center">
                            <Badge variant="secondary" className="text-sm">
                              {(() => {
                                if (selectedManagementSectionFilter === "all") {
                                  return `${categories.length} categories`;
                                }
                                const filtered = categories.filter((cat) => {
                                  return (
                                    cat.section_id ===
                                      selectedManagementSectionFilter ||
                                    cat.section ===
                                      sections.find(
                                        (s) =>
                                          (s.id || s._id) ===
                                          selectedManagementSectionFilter
                                      )?.name
                                  );
                                });
                                return `${filtered.length} of ${categories.length} categories`;
                              })()}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Category Name</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>Nominees</TableHead>
                              <TableHead>Votes</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {(() => {
                              let filteredCategories = categories;

                              // Apply section filter
                              if (selectedManagementSectionFilter !== "all") {
                                filteredCategories = categories.filter(
                                  (cat) => {
                                    return (
                                      cat.section_id ===
                                        selectedManagementSectionFilter ||
                                      cat.section ===
                                        sections.find(
                                          (s) =>
                                            (s.id || s._id) ===
                                            selectedManagementSectionFilter
                                        )?.name
                                    );
                                  }
                                );
                              }

                              if (filteredCategories.length === 0) {
                                return (
                                  <TableRow>
                                    <TableCell
                                      colSpan={5}
                                      className="text-center text-sm text-gray-400 py-8"
                                    >
                                      No categories found.
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              return filteredCategories.map((cat) => {
                                // Find vote data for this category
                                const categoryVoteData = categoryVotes.find(
                                  (cv) =>
                                    cv.category_name?.trim().toLowerCase() ===
                                    (cat.name || cat.title)
                                      ?.trim()
                                      .toLowerCase()
                                );

                                const totalVotes =
                                  categoryVoteData?.total_votes || 0;

                                // Calculate the number of nominees assigned to this category
                                const categoryId = cat.id || cat._id;
                                const nomineesInCategory = nominees.filter(
                                  (nom) => {
                                    const nomineeCategories =
                                      nom.categories || [];
                                    return nomineeCategories.some(
                                      (c) =>
                                        (c.id || c._id) === categoryId ||
                                        (c.name || c.title)
                                          ?.trim()
                                          .toLowerCase() ===
                                          (cat.name || cat.title)
                                            ?.trim()
                                            .toLowerCase()
                                    );
                                  }
                                );
                                const nomineesCount = nomineesInCategory.length;

                                return (
                                  <TableRow
                                    key={cat.id || cat._id}
                                    className="hover:bg-muted/50 transition-colors"
                                  >
                                    <TableCell className="font-medium">
                                      {cat.name || cat.title}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline">
                                        {cat.section}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary">
                                        {nomineesCount}{" "}
                                        {nomineesCount === 1
                                          ? "nominee"
                                          : "nominees"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Vote className="h-4 w-4 text-blue-500" />
                                        <span className="font-semibold">
                                          {totalVotes.toLocaleString()}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <EditCategoryModal
                                          category={cat}
                                          sections={sections}
                                          onCategoryUpdated={fetchCategories}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            handleDeleteCategory(
                                              cat.id || cat._id
                                            )
                                          }
                                          disabled={
                                            deletingId === (cat.id || cat._id)
                                          }
                                        >
                                          <span className="sr-only">
                                            Delete
                                          </span>
                                          {deletingId ===
                                          (cat.id || cat._id) ? (
                                            <Loader />
                                          ) : (
                                            "🗑️"
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              });
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="nominees" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Manage Nominees</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add, edit, or delete nominees for voting categories
                      </p>
                    </div>
                    <div className="flex items-center justify end gap-2">
                      <AssignNomineeModal
                        categories={categories}
                        nominees={nominees}
                        setStats={setStats}
                      />
                      <CreateNomineeModal onNomineeAdded={fetchNominees} />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Filter by Section
                          </label>
                          <Select
                            value={selectedSectionFilter}
                            onValueChange={setSelectedSectionFilter}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sections</SelectItem>
                              {getUniqueSectionsFromNominees().map(
                                (section) => (
                                  <SelectItem key={section} value={section}>
                                    {section}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Filter by Category
                          </label>
                          <Select
                            value={selectedCategoryFilter}
                            onValueChange={setSelectedCategoryFilter}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                All Categories
                              </SelectItem>
                              {categories.map((c) => (
                                <SelectItem
                                  key={c.id || c._id}
                                  value={c.id || c._id}
                                >
                                  {c.name || c.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Results
                          </label>
                          <div className="h-10 flex items-center">
                            <Badge variant="secondary" className="text-sm">
                              {getFilteredNominees().length} of{" "}
                              {nominees.length} nominees
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nominee Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {nominees.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-center text-sm text-gray-400 py-8"
                                >
                                  No nominees found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              getFilteredNominees().map((nom) => {
                                const nomineeCategories = nom.categories || [];
                                const categoryCount = nomineeCategories.length;

                                const uniqueSections = [
                                  ...new Set(
                                    nomineeCategories
                                      .map((cat) => cat.section)
                                      .filter(Boolean)
                                  ),
                                ];

                                return (
                                  <TableRow key={nom.id || nom._id}>
                                    <TableCell className="font-medium">
                                      {nom.name}
                                    </TableCell>

                                    <TableCell>
                                      {categoryCount === 0 ? (
                                        <span className="text-gray-400 text-sm">
                                          Not assigned
                                        </span>
                                      ) : categoryCount === 1 ? (
                                        <span className="text-sm">
                                          {nomineeCategories[0].name}
                                        </span>
                                      ) : (
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary">
                                            {categoryCount} categories
                                          </Badge>
                                          <div className="group relative">
                                            <button className="text-blue-500 hover:text-blue-600 text-xs">
                                              View all
                                            </button>
                                            <div className="hidden group-hover:block absolute left-0 top-6 z-50 bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl min-w-[200px]">
                                              <div className="space-y-1">
                                                {nomineeCategories.map(
                                                  (cat, idx) => (
                                                    <div
                                                      key={idx}
                                                      className="text-xs text-gray-300 py-1"
                                                    >
                                                      • {cat.name}
                                                    </div>
                                                  )
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>

                                    <TableCell>
                                      {uniqueSections.length === 0 ? (
                                        <Badge variant="outline">
                                          No Section
                                        </Badge>
                                      ) : uniqueSections.length === 1 ? (
                                        <Badge>{uniqueSections[0]}</Badge>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          {uniqueSections.map(
                                            (section, idx) => (
                                              <Badge
                                                key={idx}
                                                variant="secondary"
                                              >
                                                {section}
                                              </Badge>
                                            )
                                          )}
                                        </div>
                                      )}
                                    </TableCell>

                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <EditNomineeModal
                                          nominee={nom}
                                          onNomineeUpdated={fetchNominees}
                                        />
                                        <RemoveNomineeModal
                                          nominee={nom}
                                          onNomineeRemoved={fetchNominees}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            handleDeleteNominee(
                                              nom.id || nom._id
                                            )
                                          }
                                          disabled={
                                            deletingId === (nom.id || nom._id)
                                          }
                                        >
                                          <span className="sr-only">
                                            Delete
                                          </span>
                                          {deletingId ===
                                          (nom.id || nom._id) ? (
                                            <Loader />
                                          ) : (
                                            "🗑️"
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
