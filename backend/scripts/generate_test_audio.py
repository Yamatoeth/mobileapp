from gtts import gTTS

text = "Hello. What is the capital of Japan?"

tts = gTTS(text=text, lang="en")
tts.save("test_question.mp3")

print("Audio file created")