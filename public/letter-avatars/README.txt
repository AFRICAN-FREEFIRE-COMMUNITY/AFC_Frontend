letter-avatars/ — assets for the A-Z Letter-Avatar picker
=========================================================

Consumed by: components/ui/letter-avatar-picker.tsx (the LetterAvatarPicker
component, when rendered with showExplainer={true}).

ACTION REQUIRED (owner)
-----------------------
Add an image named exactly:

    explainer.png

to THIS folder (public/letter-avatars/explainer.png).

It should be the official Free Fire letter-avatar grid (the picture showing the
A-Z avatar set) so users can see what each letter avatar looks like while they
pick. A wide PNG works best (it is rendered at max-w-md, object-contain, inside
a rounded-md bordered card).

GRACEFUL FALLBACK
-----------------
The picker references /letter-avatars/explainer.png with an onError handler that
HIDES the image if the file is missing. So it is safe to ship the component
before this file exists: the picker simply renders without the reference image.
Once explainer.png is added, any picker mounted with showExplainer will show it
automatically. No code change is needed.
