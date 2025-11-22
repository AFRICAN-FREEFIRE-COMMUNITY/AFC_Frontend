"use client";
import React, { useState, useEffect } from "react";
import {
  Award,
  Users,
  Trophy,
  X,
  Check,
  AlertCircle,
  Plus,
  Loader,
  Trash2,
  Eye,
  FolderPlus,
} from "lucide-react";
import { env } from "@/lib/env";
import AdminLayout from "@/components/AdminLayout";
import { FullLoader } from "@/components/Loader";
import { useAuth } from "@/contexts/AuthContext";

export default function page() {
  const { user, token } = useAuth();

  const [formData, setFormData] = useState({
    category_id: "",
    nominee_id: "",
  });
  const [newNomineeData, setNewNomineeData] = useState({
    name: "",
    video_url: "",
  });
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    section_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [sections, setSections] = useState([]);
  const [showNewNomineeForm, setShowNewNomineeForm] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [showCategoriesList, setShowCategoriesList] = useState(false);
  const [showNomineesList, setShowNomineesList] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [stats, setStats] = useState({
    totalCategories: 0,
    totalNominees: 0,
    totalAssignments: 0,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setFetchingData(true);
    try {
      await Promise.all([fetchCategories(), fetchNominees(), fetchSections()]);
    } catch (error) {
      setMessage({ type: "error", text: "Failed to load initial data" });
    } finally {
      setFetchingData(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/categories/view/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const categoriesData = data.categories || data || [];
        setCategories(categoriesData);
        setStats((prev) => ({
          ...prev,
          totalCategories: categoriesData.length,
        }));
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchNominees = async () => {
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/nominees/view/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const nomineesData = data.nominees || data || [];
        setNominees(nomineesData);
        setStats((prev) => ({ ...prev, totalNominees: nomineesData.length }));
      }
    } catch (error) {
      console.error("Error fetching nominees:", error);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/sections/all/`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSections(data.sections || data || []);
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      // Create default sections if API fails
      setSections([
        { id: "content", name: "Content Creator Awards" },
        { id: "esports", name: "Esports Awards" },
      ]);
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryData.name.trim() || !newCategoryData.section_id) {
      setMessage({
        type: "error",
        text: "Category name and section are required",
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/categories/add/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newCategoryData.name,
            section_id: newCategoryData.section_id,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "New category created successfully!",
        });
        setNewCategoryData({ name: "", section_id: "" });
        setShowNewCategoryForm(false);
        await fetchCategories();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to create category",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? This action cannot be undone."
      )
    ) {
      return;
    }

    setDeletingId(categoryId);

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/categories/delete/`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ category_id: categoryId }),
        }
      );

      if (response.ok) {
        setMessage({ type: "success", text: "Category deleted successfully!" });
        await fetchCategories();
      } else {
        const data = await response.json();
        setMessage({
          type: "error",
          text: data.message || "Failed to delete category",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddNewNominee = async () => {
    if (!newNomineeData.name.trim()) {
      setMessage({ type: "error", text: "Nominee name is required" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/nominees/add/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: newNomineeData.name,
            video_url: newNomineeData.video_url || "",
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "New nominee created successfully!",
        });
        setNewNomineeData({ name: "", video_url: "" });
        setShowNewNomineeForm(false);
        await fetchNominees();
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to create nominee",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignNominee = async () => {
    if (!formData.category_id || !formData.nominee_id) {
      setMessage({
        type: "error",
        text: "Please select both category and nominee",
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/add/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: "success",
          text: "Nominee added to category successfully!",
        });
        setFormData({ category_id: "", nominee_id: "" });
        setStats((prev) => ({
          ...prev,
          totalAssignments: prev.totalAssignments + 1,
        }));
      } else {
        setMessage({
          type: "error",
          text: data.message || "Failed to add nominee to category",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({ category_id: "", nominee_id: "" });
    setMessage({ type: "", text: "" });
  };

  const getSelectedCategory = () => {
    return categories.find(
      (c) => c.id === formData.category_id || c._id === formData.category_id
    );
  };

  const getSelectedNominee = () => {
    return nominees.find(
      (n) => n.id === formData.nominee_id || n._id === formData.nominee_id
    );
  };

  const getSectionName = (sectionId) => {
    const section = sections.find((s) => (s.id || s._id) === sectionId);
    return section ? section.name || section.title : "Unknown Section";
  };

  if (fetchingData) {
    return <FullLoader />;
  }

  return (
    <AdminLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className=" border-b py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Awards Management Dashboard
              </h1>
              <p className="text-gray-400">
                Complete awards management system - Create, manage, and assign
              </p>
            </div>
            <div className="text-right text-sm text-gray-400">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="py-8">
          <div>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className=" border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
                <div className="text-3xl font-bold mb-1">
                  {stats.totalCategories}
                </div>
                <div className="text-gray-400 text-sm">Total Categories</div>
              </div>

              <div className=" border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <Users className="w-8 h-8 text-blue-500" />
                </div>
                <div className="text-3xl font-bold mb-1">
                  {stats.totalNominees}
                </div>
                <div className="text-gray-400 text-sm">Total Nominees</div>
              </div>

              <div className=" border rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <Award className="w-8 h-8 text-purple-500" />
                </div>
                <div className="text-3xl font-bold mb-1">
                  {stats.totalAssignments}
                </div>
                <div className="text-gray-400 text-sm">Total Assignments</div>
              </div>
            </div>

            {/* Alert Messages */}
            {message.text && (
              <div
                className={`mb-6 p-4 rounded-lg flex items-start ${
                  message.type === "success"
                    ? "bg-green-900/30 border border-green-700"
                    : "bg-red-900/30 border border-red-700"
                }`}
              >
                {message.type === "success" ? (
                  <Check className="w-5 h-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={
                      message.type === "success"
                        ? "text-green-300"
                        : "text-red-300"
                    }
                  >
                    {message.text}
                  </p>
                </div>
                <button
                  onClick={() => setMessage({ type: "", text: "" })}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <button
                onClick={() => {
                  setShowCategoriesList(!showCategoriesList);
                  setShowNomineesList(false);
                }}
                className=" border hover:border-yellow-500 rounded-lg p-6 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Trophy className="w-8 h-8 text-yellow-500 mr-4" />
                    <div>
                      <h3 className="text-lg font-bold mb-1">
                        View All Categories
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Manage award categories
                      </p>
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              <button
                onClick={() => {
                  setShowNomineesList(!showNomineesList);
                  setShowCategoriesList(false);
                }}
                className=" border hover:border-blue-500 rounded-lg p-6 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="w-8 h-8 text-blue-500 mr-4" />
                    <div>
                      <h3 className="text-lg font-bold mb-1">
                        View All Nominees
                      </h3>
                      <p className="text-gray-400 text-sm">
                        Browse all nominees
                      </p>
                    </div>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            </div>

            {/* Categories List */}
            {showCategoriesList && (
              <div className=" border rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <Trophy className="w-6 h-6 text-yellow-500 mr-3" />
                  All Award Categories ({categories.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {categories.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      No categories yet. Create your first category below!
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <div
                        key={cat.id || cat._id}
                        className=" rounded-lg p-4 flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-1">
                            {cat.name || cat.title}
                          </h4>
                          <p className="text-gray-400 text-sm">
                            Section: {getSectionName(cat.section_id)}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleDeleteCategory(cat.id || cat._id)
                          }
                          disabled={deletingId === (cat.id || cat._id)}
                          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
                        >
                          {deletingId === (cat.id || cat._id) ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Nominees List */}
            {showNomineesList && (
              <div className=" border rounded-lg p-6 mb-8">
                <h3 className="text-xl font-bold mb-4 flex items-center">
                  <Users className="w-6 h-6 text-blue-500 mr-3" />
                  All Nominees ({nominees.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {nominees.length === 0 ? (
                    <p className="text-gray-400 text-center py-8 col-span-2">
                      No nominees yet. Create your first nominee below!
                    </p>
                  ) : (
                    nominees.map((nom) => (
                      <div key={nom.id || nom._id} className=" rounded-lg p-4">
                        <h4 className="font-semibold text-white mb-1">
                          {nom.name}
                        </h4>
                        {nom.video_url && (
                          <a
                            href={nom.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 text-sm hover:underline"
                          >
                            View Video →
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Create New Category Section */}
            <div className=" border rounded-lg p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <FolderPlus className="w-6 h-6 text-yellow-500 mr-3" />
                  <h2 className="text-2xl font-bold">Create New Category</h2>
                </div>
                <button
                  onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  {showNewCategoryForm ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      New Category
                    </>
                  )}
                </button>
              </div>

              {showNewCategoryForm && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      value={newCategoryData.name}
                      onChange={(e) =>
                        setNewCategoryData({
                          ...newCategoryData,
                          name: e.target.value,
                        })
                      }
                      placeholder="e.g., Best Content Creator, Best Esports Player"
                      className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">
                      Section *
                    </label>
                    <select
                      value={newCategoryData.section_id}
                      onChange={(e) =>
                        setNewCategoryData({
                          ...newCategoryData,
                          section_id: e.target.value,
                        })
                      }
                      className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    >
                      <option value="">-- Select a section --</option>
                      {sections.map((section) => (
                        <option
                          key={section.id || section._id}
                          value={section.id || section._id}
                        >
                          {section.name || section.title}
                        </option>
                      ))}
                    </select>
                    <p className="text-gray-500 text-xs mt-2">
                      Categories are grouped into sections (e.g., Content
                      Creator Awards, Esports Awards)
                    </p>
                  </div>

                  <button
                    onClick={handleAddNewCategory}
                    disabled={loading}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Create Category
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Create New Nominee Section */}
            <div className=" border rounded-lg p-8 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Plus className="w-6 h-6 text-blue-500 mr-3" />
                  <h2 className="text-2xl font-bold">Create New Nominee</h2>
                </div>
                <button
                  onClick={() => setShowNewNomineeForm(!showNewNomineeForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  {showNewNomineeForm ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      New Nominee
                    </>
                  )}
                </button>
              </div>

              {showNewNomineeForm && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">
                      Nominee Name *
                    </label>
                    <input
                      type="text"
                      value={newNomineeData.name}
                      onChange={(e) =>
                        setNewNomineeData({
                          ...newNomineeData,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter nominee name"
                      className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3 text-gray-300">
                      Video URL{" "}
                      <span className="text-gray-500">
                        (Optional - for Best Video Award)
                      </span>
                    </label>
                    <input
                      type="url"
                      value={newNomineeData.video_url}
                      onChange={(e) =>
                        setNewNomineeData({
                          ...newNomineeData,
                          video_url: e.target.value,
                        })
                      }
                      placeholder="https://youtube.com/watch?v=..."
                      className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-gray-500 text-xs mt-2">
                      Add a video URL for video-based award categories
                    </p>
                  </div>

                  <button
                    onClick={handleAddNewNominee}
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Create Nominee
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Assign Nominee to Category Section */}
            <div className=" border rounded-lg p-8">
              <div className="flex items-center mb-6">
                <Award className="w-6 h-6 text-green-500 mr-3" />
                <h2 className="text-2xl font-bold">
                  Assign Nominee to Category
                </h2>
              </div>

              <div>
                {/* Category Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-3 text-gray-300">
                    Select Award Category *
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData({ ...formData, category_id: e.target.value })
                    }
                    className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">-- Choose a category --</option>
                    {categories.map((cat) => (
                      <option key={cat.id || cat._id} value={cat.id || cat._id}>
                        {cat.name || cat.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-2">
                    Select the award category you want to add a nominee to
                  </p>
                </div>

                {/* Nominee Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-medium mb-3 text-gray-300">
                    Select Nominee *
                  </label>
                  <select
                    value={formData.nominee_id}
                    onChange={(e) =>
                      setFormData({ ...formData, nominee_id: e.target.value })
                    }
                    className="w-full  border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">-- Choose a nominee --</option>
                    {nominees.map((nom) => (
                      <option key={nom.id || nom._id} value={nom.id || nom._id}>
                        {nom.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-gray-500 text-xs mt-2">
                    Select the player/creator to nominate for this category
                  </p>
                </div>

                {/* Preview Section */}
                {formData.category_id && formData.nominee_id && (
                  <div className="mb-8 p-4 /50 border border-gray-600 rounded-lg">
                    <h3 className="text-sm font-semibold mb-3 text-gray-300">
                      Assignment Preview
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Category:</span>
                        <span className="text-white font-medium">
                          {getSelectedCategory()?.name ||
                            getSelectedCategory()?.title}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Nominee:</span>
                        <span className="text-white font-medium">
                          {getSelectedNominee()?.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4">
                  <button
                    onClick={handleAssignNominee}
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Add Nominee to Category
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleReset}
                    disabled={loading}
                    className=" hover:bg-gray-600 disabled: disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center"
                  >
                    <X className="w-5 h-5 mr-2" />
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div className="mt-8  border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-blue-500" />
                Quick Guide
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Workflow:</h4>
                  <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
                    <li>Create award categories using the section above</li>
                    <li>
                      Create nominees (players/creators) with their details
                    </li>
                    <li>Assign nominees to appropriate categories</li>
                    <li>View and manage all categories and nominees</li>
                  </ol>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">
                    Important Notes:
                  </h4>
                  <ul className="space-y-2 text-sm text-gray-400">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>
                        Categories must belong to a section (Content Creator or
                        Esports)
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>
                        Video URLs are required for video-based award categories
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>
                        A nominee can be assigned to multiple categories
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>
                        Deleting a category will remove all associated nominees
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">•</span>
                      <span>
                        Use the "View All" buttons to review existing data
                        before creating duplicates
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
