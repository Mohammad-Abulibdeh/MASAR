# تفعيل تسجيل الدخول في مسار (Firebase)

التطبيق جاهز لتسجيل الدخول بالإيميل وكلمة السر، ومزامنة الاسم والأماكن والرحلات والإعدادات.
بس بدّه مشروع Firebase تبعك. Firebase مجاني لهالاستعمال (خطة Spark).

## الخطوات (حوالي 10 دقايق)

1. افتح https://console.firebase.google.com وادخل بحساب Google تبعك.
2. **Add project** ← سمّيه `masar` ← كمّل (Google Analytics مش ضروري).
3. **Build ← Authentication ← Get started ← Sign-in method ← Email/Password ← Enable ← Save.**
4. **Build ← Firestore Database ← Create database** ← اختار موقع قريب (مثلا `europe-west`) ← **Start in production mode**.
5. بنفس صفحة Firestore افتح **Rules** وحط هاي القواعد واضغط **Publish**
   (كل مستخدم بيقدر يقرأ ويكتب ملفه هو بس):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid} {
         allow read, write, delete: if request.auth != null && request.auth.uid == uid;
       }
       // Road reports (accident, checkpoint, closure...): everyone reads, signed-in drivers add and vote.
       match /reports/{id} {
         allow read: if true;
         allow create: if request.auth != null
           && request.resource.data.keys().hasOnly(['kind', 'lat', 'lng', 't', 'uid', 'up', 'down'])
           && request.resource.data.uid == request.auth.uid
           && request.resource.data.kind in ['traffic', 'accident', 'hazard', 'police', 'checkpoint', 'closed']
           && request.resource.data.lat is number && request.resource.data.lat > 31.6 && request.resource.data.lat < 32.3
           && request.resource.data.lng is number && request.resource.data.lng > 34.9 && request.resource.data.lng < 35.6
           && request.resource.data.t is int
           && request.resource.data.t > request.time.toMillis() - 900000
           && request.resource.data.t < request.time.toMillis() + 900000
           && request.resource.data.up == 0 && request.resource.data.down == 0;
         allow update: if request.auth != null
           && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['up', 'down'])
           && request.resource.data.up >= resource.data.up && request.resource.data.up <= resource.data.up + 1
           && request.resource.data.down >= resource.data.down && request.resource.data.down <= resource.data.down + 1;
         allow delete: if request.auth != null && resource.data.uid == request.auth.uid;
       }
     }
   }
   ```

6. **Project settings** (الترس فوق) ← **General** ← تحت **Your apps** اضغط على أيقونة الويب `</>` ← سمّيه `masar-app` ← **Register app**.
7. رح يطلعلك كود فيه `firebaseConfig`. بدنا منه سطرين بس: `apiKey` و `projectId`.
   ابعثهم لـ Claude، أو حطهم بنفسك بملف `www/firebase-config.js`:

   ```js
   window.MASAR_FIREBASE = {
     apiKey: 'AIza...',
     projectId: 'masar-xxxxx',
   };
   ```

8. ابني التطبيق من جديد (`build.ps1`) وثبّته.

`apiKey` الخاص بالويب مش سر: هو بس بيعرّف المشروع، والحماية الحقيقية هي قواعد Firestore بالخطوة 5.

## شو بينحفظ وين

- **على الموبايل:** الاسم والأماكن والرحلات والإعدادات (زي قبل).
- **بحساب Firebase (إذا سجّلت دخول):** نفس البيانات، بملف واحد `users/<uid>`، حتى تلاقيها على أي موبايل.
- **الموقع اللحظي ما بينبعث أبدا.** التطبيق ما بيتصل بالإنترنت إلا مع
  `identitytoolkit.googleapis.com` و `securetoken.googleapis.com` و `firestore.googleapis.com`.
- صفحة **الخصوصية** فيها «احذف حسابي»، وهو بيحذف الحساب والملف تبعه.
