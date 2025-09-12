// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import AdminLayout from "@/components/AdminLayout";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { ImageUploader } from "@/components/ImageUploader";
// import { useToast } from "@/components/ui/use-toast";
// import { SimpleRichTextEditor } from "@/components/SimpleRichTextEditor";
// import { SearchableEventDropdown } from "@/components/SearchableEventDropdown";

// const categories = [
//   { value: "general-news", label: "General News" },
//   { value: "tournament-updates", label: "Tournament Updates" },
//   { value: "banned-updates", label: "Banned Player/Team Updates" },
// ];

// const events = [
//   { value: "event1", label: "Summer Showdown 2023" },
//   { value: "event2", label: "Fall Classic 2023" },
//   { value: "event3", label: "Winter Cup 2023" },
// ];

// export default function CreateNewsForm() {
//   const router = useRouter();
//   const { toast } = useToast();
//   const [title, setTitle] = useState("");
//   const [content, setContent] = useState("");
//   const [category, setCategory] = useState("");
//   const [event, setEvent] = useState("");
//   const [images, setImages] = useState<string[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [author, setAuthor] = useState(""); // Updated: Initialize author with initialUsername

//   const [isAuthenticated, setIsAuthenticated] = useState(false);
//   const [currentUser, setCurrentUser] = useState(null);

//   useEffect(() => {
//     // Simulate an authentication check and fetching current user
//     const checkAuth = async () => {
//       // In a real app, this would check for a valid session or token and fetch user data
//       await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
//       setIsAuthenticated(true);
//       setCurrentUser({ name: "Admin User" }); // Replace with actual user data
//     };
//     checkAuth();
//   }, []);

//   if (!isAuthenticated) {
//     return <div>Loading...</div>;
//   }

//   const handleImageUpload = (imageUrl: string) => {
//     setImages([...images, imageUrl]);
//   };

//   const handleSaveDraft = async () => {
//     setIsLoading(true);
//     try {
//       const newsData = {
//         title,
//         content,
//         category,
//         event,
//         images,
//         author,
//       };
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       toast({
//         title: "Draft Saved",
//         description: "The news article has been saved as a draft.",
//       });
//       router.push("/admin/news");
//     } catch (error) {
//       toast({
//         title: "Error",
//         description:
//           "An error occurred while saving the draft. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handlePublish = async () => {
//     setIsLoading(true);
//     try {
//       const newsData = {
//         title,
//         content,
//         category,
//         event,
//         images,
//         author,
//       };
//       await new Promise((resolve) => setTimeout(resolve, 1000));
//       toast({
//         title: "News Published",
//         description: "The news article has been successfully published.",
//       });
//       router.push("/admin/news");
//     } catch (error) {
//       toast({
//         title: "Error",
//         description:
//           "An error occurred while publishing the news. Please try again.",
//         variant: "destructive",
//       });
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="container mx-auto px-4 py-8">
//       <h1 className="text-3xl font-bold mb-8">Create News & Announcement</h1>
//       <form>
//         <Card className="mb-8">
//           <CardHeader>
//             <CardTitle>News Details</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <div>
//               <Label htmlFor="title">Title</Label>
//               <Input
//                 id="title"
//                 value={title}
//                 onChange={(e) => setTitle(e.target.value)}
//                 placeholder="Enter news title"
//                 required
//               />
//             </div>
//             <div>
//               <Label htmlFor="content">Content</Label>
//               <SimpleRichTextEditor
//                 initialValue={content}
//                 onChange={setContent}
//               />
//             </div>
//             <div>
//               <Label htmlFor="category">Category</Label>
//               <Select value={category} onValueChange={setCategory}>
//                 <SelectTrigger>
//                   <SelectValue placeholder="Select category" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   {categories.map((cat) => (
//                     <SelectItem key={cat.value} value={cat.value}>
//                       {cat.label}
//                     </SelectItem>
//                   ))}
//                 </SelectContent>
//               </Select>
//             </div>
//             <div>
//               <Label htmlFor="event">Related Event (Optional)</Label>
//               <SearchableEventDropdown value={event} onValueChange={setEvent} />
//             </div>
//             <div>
//               <Label>Images</Label>
//               <ImageUploader onImageUpload={handleImageUpload} />
//               <div className="mt-2 flex flex-wrap gap-2">
//                 {images.map((img, index) => (
//                   <img
//                     key={index}
//                     src={img || "/placeholder.svg"}
//                     alt={`Uploaded ${index + 1}`}
//                     className="w-20 h-20 object-cover"
//                   />
//                 ))}
//               </div>
//             </div>
//             <div>
//               <Label htmlFor="author">Author</Label>
//               <Input id="author" value={author} disabled />{" "}
//               {/* Updated: Author input is now disabled */}
//             </div>
//           </CardContent>
//         </Card>
//         <div className="flex justify-end space-x-4">
//           <Button
//             type="button"
//             variant="outline"
//             onClick={() => router.push("/admin/news")}
//           >
//             Cancel
//           </Button>
//           <Button type="button" onClick={handleSaveDraft} disabled={isLoading}>
//             {isLoading ? "Saving..." : "Save to Drafts"}
//           </Button>
//           <Button type="button" onClick={handlePublish} disabled={isLoading}>
//             {isLoading ? "Publishing..." : "Publish"}
//           </Button>
//         </div>
//       </form>
//     </div>
//   );
// }

// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import * as z from "zod";
// import axios from "axios";
// import {
//   Form,
//   FormControl,
//   FormDescription,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
// import { ImageUploader } from "@/components/ImageUploader";
// import { toast } from "sonner";
// import { useAuth } from "@/contexts/AuthContext";
// import { env } from "@/lib/env";
// import {
//   Loader2,
//   Save,
//   Send,
//   X,
//   Upload,
//   FileText,
//   Calendar,
//   User,
//   Tag
// } from "lucide-react";

// // Form validation schema
// const newsFormSchema = z.object({
//   title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
//   content: z.string().min(1, "Content is required"),
//   category: z.string().min(1, "Category is required"),
//   event: z.string().optional(),
//   author: z.string().min(1, "Author is required"),
//   images: z.array(z.string()).optional(),
// });

// type NewsFormValues = z.infer<typeof newsFormSchema>;

// const categories = [
//   { value: "general-news", label: "General News" },
//   { value: "tournament-updates", label: "Tournament Updates" },
//   { value: "banned-updates", label: "Banned Player/Team Updates" },
//   { value: "maintenance", label: "Maintenance Updates" },
//   { value: "events", label: "Event Announcements" },
// ];

// const events = [
//   { value: "event1", label: "Summer Showdown 2024" },
//   { value: "event2", label: "Fall Classic 2024" },
//   { value: "event3", label: "Winter Cup 2024" },
//   { value: "event4", label: "Spring Championship 2025" },
// ];

// export default function CreateNewsForm() {
//   const router = useRouter();
//   const { user, token } = useAuth();
//   const [isLoading, setIsLoading] = useState(false);
//   const [uploadedImages, setUploadedImages] = useState<string[]>([]);

//   const form = useForm<NewsFormValues>({
//     resolver: zodResolver(newsFormSchema),
//     defaultValues: {
//       title: "",
//       content: "",
//       category: "",
//       event: "",
//       author: user?.full_name || "",
//       images: [],
//     },
//   });

//   const handleImageUpload = (imageUrl: string) => {
//     const newImages = [...uploadedImages, imageUrl];
//     setUploadedImages(newImages);
//     form.setValue("images", newImages);
//   };

//   const removeImage = (index: number) => {
//     const newImages = uploadedImages.filter((_, i) => i !== index);
//     setUploadedImages(newImages);
//     form.setValue("images", newImages);
//   };

//   const onSubmit = async (data: NewsFormValues, isDraft = false) => {
//     if (!token) {
//       toast.error("You must be logged in to create news");
//       return;
//     }

//     setIsLoading(true);

//     try {
//       const payload = {
//         title: data.title,
//         content: data.content,
//         category: data.category,
//         event: data.event || null,
//         author: data.author,
//         images: data.images || [],
//         is_draft: isDraft,
//         published_at: isDraft ? null : new Date().toISOString(),
//       };

//       const response = await axios.post(
//         `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/create-news/`,
//         payload,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       if (response.status === 200 || response.status === 201) {
//         toast.success(
//           isDraft ? "News saved as draft successfully!" : "News published successfully!"
//         );
//         router.push("/admin/news");
//       }
//     } catch (error: any) {
//       console.error("Error creating news:", error);
//       const errorMessage = error.response?.data?.message ||
//                           error.response?.data?.error ||
//                           "Failed to create news. Please try again.";
//       toast.error(errorMessage);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleSaveDraft = () => {
//     form.handleSubmit((data) => onSubmit(data, true))();
//   };

//   const handlePublish = () => {
//     form.handleSubmit((data) => onSubmit(data, false))();
//   };

//   return (
//     <div className="container mx-auto px-4 py-8 max-w-4xl">
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold flex items-center gap-2">
//           <FileText className="h-8 w-8" />
//           Create News & Announcement
//         </h1>
//         <p className="text-muted-foreground mt-2">
//           Create and publish news articles for the AFC Database community
//         </p>
//       </div>

//       <Form {...form}>
//         <form className="space-y-6">
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <FileText className="h-5 w-5" />
//                 Article Details
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-6">
//               {/* Title */}
//               <FormField
//                 control={form.control}
//                 name="title"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Title *</FormLabel>
//                     <FormControl>
//                       <Input
//                         placeholder="Enter an engaging title for your news article"
//                         {...field}
//                         className="text-lg"
//                       />
//                     </FormControl>
//                     <FormDescription>
//                       A clear, descriptive title that summarizes your news
//                     </FormDescription>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               {/* Content */}
//               <FormField
//                 control={form.control}
//                 name="content"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel>Content *</FormLabel>
//                     <FormControl>
//                       <Textarea
//                         placeholder="Write your news content here..."
//                         className="min-h-[200px] resize-y"
//                         {...field}
//                       />
//                     </FormControl>
//                     <FormDescription>
//                       The main content of your news article. You can use markdown formatting.
//                     </FormDescription>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />

//               {/* Category and Event Row */}
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                 <FormField
//                   control={form.control}
//                   name="category"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel className="flex items-center gap-2">
//                         <Tag className="h-4 w-4" />
//                         Category *
//                       </FormLabel>
//                       <Select onValueChange={field.onChange} value={field.value}>
//                         <FormControl>
//                           <SelectTrigger>
//                             <SelectValue placeholder="Select a category" />
//                           </SelectTrigger>
//                         </FormControl>
//                         <SelectContent>
//                           {categories.map((category) => (
//                             <SelectItem key={category.value} value={category.value}>
//                               {category.label}
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />

//                 <FormField
//                   control={form.control}
//                   name="event"
//                   render={({ field }) => (
//                     <FormItem>
//                       <FormLabel className="flex items-center gap-2">
//                         <Calendar className="h-4 w-4" />
//                         Related Event
//                       </FormLabel>
//                       <Select
//                         onValueChange={(value) => {
//                           // Handle the "none" case by setting to empty string
//                           field.onChange(value === "none" ? "" : value);
//                         }}
//                         value={field.value || "none"}
//                       >
//                         <FormControl>
//                           <SelectTrigger>
//                             <SelectValue placeholder="Select an event (optional)" />
//                           </SelectTrigger>
//                         </FormControl>
//                         <SelectContent>
//                           <SelectItem value="none">No related event</SelectItem>
//                           {events.map((event) => (
//                             <SelectItem key={event.value} value={event.value}>
//                               {event.label}
//                             </SelectItem>
//                           ))}
//                         </SelectContent>
//                       </Select>
//                       <FormDescription>
//                         Link this news to a specific event if relevant
//                       </FormDescription>
//                       <FormMessage />
//                     </FormItem>
//                   )}
//                 />
//               </div>

//               {/* Author */}
//               <FormField
//                 control={form.control}
//                 name="author"
//                 render={({ field }) => (
//                   <FormItem>
//                     <FormLabel className="flex items-center gap-2">
//                       <User className="h-4 w-4" />
//                       Author
//                     </FormLabel>
//                     <FormControl>
//                       <Input {...field} disabled className="bg-muted" />
//                     </FormControl>
//                     <FormDescription>
//                       Author is automatically set to your name
//                     </FormDescription>
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//             </CardContent>
//           </Card>

//           {/* Images Section */}
//           <Card>
//             <CardHeader>
//               <CardTitle className="flex items-center gap-2">
//                 <Upload className="h-5 w-5" />
//                 Images
//               </CardTitle>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <ImageUploader onImageUpload={handleImageUpload} />

//               {uploadedImages.length > 0 && (
//                 <div>
//                   <p className="text-sm font-medium mb-3">Uploaded Images:</p>
//                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//                     {uploadedImages.map((img, index) => (
//                       <div key={index} className="relative group">
//                         <img
//                           src={img || "/placeholder.svg"}
//                           alt={`Uploaded ${index + 1}`}
//                           className="w-full h-24 object-cover rounded-lg border"
//                         />
//                         <Button
//                           type="button"
//                           variant="destructive"
//                           size="icon"
//                           className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
//                           onClick={() => removeImage(index)}
//                         >
//                           <X className="h-3 w-3" />
//                         </Button>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               )}
//             </CardContent>
//           </Card>

//           {/* Action Buttons */}
//           <div className="flex flex-col sm:flex-row justify-between gap-4">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => router.push("/admin/news")}
//               disabled={isLoading}
//             >
//               Cancel
//             </Button>

//             <div className="flex flex-col sm:flex-row gap-3">
//               <Button
//                 type="button"
//                 variant="secondary"
//                 onClick={handleSaveDraft}
//                 disabled={isLoading || !form.formState.isValid}
//                 className="flex items-center gap-2"
//               >
//                 {isLoading ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <Save className="h-4 w-4" />
//                 )}
//                 Save as Draft
//               </Button>

//               <Button
//                 type="button"
//                 onClick={handlePublish}
//                 disabled={isLoading || !form.formState.isValid}
//                 className="flex items-center gap-2"
//               >
//                 {isLoading ? (
//                   <Loader2 className="h-4 w-4 animate-spin" />
//                 ) : (
//                   <Send className="h-4 w-4" />
//                 )}
//                 Publish Now
//               </Button>
//             </div>
//           </div>
//         </form>
//       </Form>
//     </div>
//   );
// }

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  CreateNewsFormSchema,
  CreateNewsFormSchemaType,
} from "@/lib/zodSchemas";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SimpleRichTextEditor } from "@/components/SimpleRichTextEditor";
import { RichTextEditor } from "@/components/text-editor/Editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { newsCategories, relatedEvents } from "@/constants";
import { useState, useTransition } from "react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useRouter } from "next/navigation";

export function CreateNewsForm() {
  const router = useRouter();
  const { user, token } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [pending, startTransition] = useTransition();

  const form = useForm<CreateNewsFormSchemaType>({
    resolver: zodResolver(CreateNewsFormSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      event: "",
      author: user?.full_name || "",
      images: "",
    },
  });

  function handleSaveDraft() {}

  function handlePublish(data: CreateNewsFormSchemaType) {
    startTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        // Append all form fields to FormData
        formData.append("news_title", data.title);
        formData.append("content", data.content);
        formData.append("category", data.category);
        // formData.append("related_event", data.event!);
        formData.append("author", data.author);

        // Append profile picture file if selected
        if (selectedFile) {
          formData.append("images", selectedFile);
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/create-news/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        toast.success(response.data.message);
        router.push(`/news`);
      } catch (error: any) {
        toast.error(error?.response?.data?.message || "Internal server error");
        return;
      }
    });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Create News & Announcement</h1>
      <Form {...form}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>News Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              onSubmit={form.handleSubmit(handlePublish)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter news title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Content</FormLabel>
                    <FormControl>
                      <RichTextEditor field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {newsCategories.map((category, index) => (
                          <SelectItem key={index} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="event"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related Event (Optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {relatedEvents.map((event, index) => (
                          <SelectItem key={index} value={event.value}>
                            {event.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        placeholder="Select images"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);

                            // Create preview URL for display
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => {
                              const previewImage = reader.result as string;
                              // setAvatar(previewImage);
                              field.onChange(file.name);
                            };
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Author</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your name"
                        {...field}
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-4">
                <Button type="button" asChild variant="outline">
                  <Link href="/admin/news">Cancel</Link>
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={pending}
                >
                  {pending ? "Saving..." : "Save to Drafts"}
                </Button>
                <Button
                  type="submit"
                  // onClick={handlePublish}
                  disabled={pending}
                >
                  {pending ? "Publishing..." : "Publish"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Form>
    </div>
  );
}
