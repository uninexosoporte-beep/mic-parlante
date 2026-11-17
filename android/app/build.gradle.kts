plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.micparlante.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.micparlante.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 6
        versionName = "1.3.0"
    }

    // La interfaz es la misma web de ../../web: se empaqueta dentro del APK.
    sourceSets {
        getByName("main").assets.srcDir("../../web")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
