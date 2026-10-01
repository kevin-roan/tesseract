Pod::Spec.new do |s|
  s.name           = 'TheoneIsland'
  s.version        = '1.0.0'
  s.summary        = 'Live Activity, screen capture, OCR and share inbox bridge for TheOne'
  s.description    = 'Expo module that drives the TheOne Live Activity and reads the app-group inbox written by the extensions.'
  s.author         = 'TheOne'
  s.homepage       = 'https://github.com/bpract/theone-mobile'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'ActivityKit', 'Vision'

  s.source_files = "**/*.swift"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
