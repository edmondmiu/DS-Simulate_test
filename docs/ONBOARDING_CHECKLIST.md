# Team Onboarding Checklist

## 🎯 Team Setup Checklist

Use this checklist to ensure your entire team is set up correctly with the DS-Simulate token system.

### ✅ **For the Team Lead**

- [ ] **Repository Access**: Ensure team has access to `https://github.com/edmondmiu/DS-Simulate_test`
- [ ] **Share Quick Start**: Send team the [Quick Start Guide](./QUICK_START_GUIDE.md)
- [ ] **Print Command Reference**: Print and distribute [Command Reference](./COMMAND_REFERENCE.md) cards
- [ ] **Test System**: Run `npm run validate-workflow-integrity` to ensure system works
- [ ] **Verify Designer URL**: Test that `https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json` loads

### ✅ **For Each Designer**

- [ ] **Install Token Studio**: Install Figma Tokens plugin in Figma
- [ ] **Import Tokens**: Add GitHub sync with URL: `https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json`
- [ ] **Test Import**: Verify tokens load and themes are available
- [ ] **Apply Test Token**: Apply a token like `text.primary` to a text element
- [ ] **Switch Themes**: Test switching between available themes
- [ ] **Bookmark Guide**: Bookmark [Designer Import Guide](./DESIGNER_IMPORT_GUIDE.md)

### ✅ **For Each Developer**

- [ ] **Get Tokens**: Download CSS tokens or clone repository
- [ ] **Test Integration**: Apply a token like `var(--semantic-color-text-primary)` in CSS
- [ ] **Verify Updates**: Confirm tokens update when designers make changes
- [ ] **Theme Support**: Implement dark/light theme switching if needed
- [ ] **Bookmark Guide**: Bookmark [Style Dictionary Guide](./STYLE_DICTIONARY.md)

### ✅ **For Each Engineer**

- [ ] **Clone Repository**: `git clone https://github.com/edmondmiu/DS-Simulate_test.git`
- [ ] **Install Dependencies**: `npm install`
- [ ] **Test Workflow**: Run `npm run workflow:start` and `npm run workflow:finish`
- [ ] **Validate System**: Run `npm run validate-workflow-integrity`
- [ ] **Try Editing**: Edit a token in `tokens/global.json` and consolidate
- [ ] **Bookmark Guides**: Bookmark [Engineer Workflow Guide](./ENGINEER_WORKFLOW_GUIDE.md) and [Command Reference](./COMMAND_REFERENCE.md)

### ✅ **For AI Tools/Automation**

- [ ] **Test AI Workflow**: Run `npm run ai-init-session`
- [ ] **Edit Test Token**: Modify a token in `tokens/core.json`
- [ ] **Validate Changes**: Run `npm run ai-validate-changes`
- [ ] **Consolidate**: Run `npm run ai-auto-consolidate`
- [ ] **Verify Integration**: Confirm changes appear in tokensource.json
- [ ] **Bookmark Guide**: Bookmark [AI Editing Guide](./AI_EDITING_GUIDE.md)

---

## 🧪 **Team Validation Tests**

Run these tests to ensure the entire workflow works for your team:

### Test 1: Designer → Developer Flow
1. **Designer**: Import tokens and apply `text.primary` to a design element
2. **Developer**: Use `var(--semantic-color-text-primary)` in CSS
3. **Verify**: Both should show the same color

### Test 2: Engineer → Designer Flow
1. **Engineer**: Run `npm run workflow:start`, edit `tokens/global.json`, run `npm run workflow:finish`
2. **Engineer**: Commit and push changes
3. **Designer**: Sync tokens in Token Studio
4. **Verify**: Designer should see the updated token values

### Test 3: Theme Switching
1. **Designer**: Switch between themes in Token Studio
2. **Developer**: Implement theme switching in code
3. **Verify**: Both should show consistent theme changes

### Test 4: AI Integration
1. **AI Tool**: Run `npm run ai-init-session`, edit tokens, run `npm run ai-auto-consolidate`
2. **Designer**: Sync tokens in Token Studio
3. **Verify**: Designer should see AI-generated changes

---

## 📋 **Common Setup Issues & Solutions**

### Issue: "Token Studio import URL not working"
**Solution**: 
1. Test URL in browser: `https://raw.githubusercontent.com/edmondmiu/DS-Simulate_test/main/tokensource.json`
2. If it loads, clear Token Studio cache and try again
3. If it doesn't load, check repository access permissions

### Issue: "npm commands not found"
**Solution**:
1. Ensure you're in the correct directory: `cd DS-Simulate_test`
2. Install dependencies: `npm install`
3. Verify Node.js is installed: `node --version` (should be 14+)

### Issue: "Validation errors"
**Solution**:
1. Run detailed validation: `npm run validate:comprehensive`
2. Check for JSON syntax errors in token files
3. Verify all token references exist

### Issue: "Git conflicts in tokensource.json"
**Solution**:
1. Use modular workflow: `npm run split-source-to-tokens`
2. Resolve conflicts in individual token files (much easier!)
3. Consolidate back: `npm run consolidate-to-source`

---

## 🎓 **Training Resources**

### Self-Service Learning
- **[Quick Start Guide](./QUICK_START_GUIDE.md)** - 5-minute role-based setup
- **[Command Reference](./COMMAND_REFERENCE.md)** - Essential commands
- **Interactive Help**: Run `npm run help` for command guidance

### Role-Specific Deep Dives
- **Designers**: [Designer Import Guide](./DESIGNER_IMPORT_GUIDE.md)
- **Developers**: [Style Dictionary Guide](./STYLE_DICTIONARY.md)
- **Engineers**: [Engineer Workflow Guide](./ENGINEER_WORKFLOW_GUIDE.md)
- **AI Tools**: [AI Editing Guide](./AI_EDITING_GUIDE.md)

### Advanced Topics
- **System Architecture**: [Token Architecture](./TOKEN_ARCHITECTURE.md)
- **Workflow Details**: [Pipeline Workflow](./PIPELINE_WORKFLOW.md)
- **Migration**: [Migration Guide](./MIGRATION_GUIDE.md)

---

## 🚀 **Success Metrics**

Track these metrics to measure successful team adoption:

### Week 1 Goals
- [ ] All designers can import tokens successfully
- [ ] All developers can use tokens in their code
- [ ] All engineers can run basic workflow commands
- [ ] System validation passes for all team members

### Week 2 Goals
- [ ] Designers are using semantic tokens (not core tokens)
- [ ] Developers have implemented theme switching
- [ ] Engineers are comfortable with the modular workflow
- [ ] At least one successful token change has flowed through the entire system

### Month 1 Goals
- [ ] Team is self-sufficient with token system
- [ ] No training required for new team members (they can use the guides)
- [ ] Token changes flow smoothly from design to development
- [ ] System is integrated into regular development workflow

---

## 📞 **Getting Help**

### Self-Service Options
1. **Command Help**: Run `npm run help`
2. **System Health**: Run `npm run validate-workflow-integrity`
3. **Documentation**: Check the `docs/` folder
4. **Troubleshooting**: See [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)

### Escalation Path
1. **Technical Issues**: Check validation output for specific errors
2. **Workflow Questions**: Consult role-specific guides
3. **System Problems**: Contact design system team with validation output
4. **Feature Requests**: Submit through standard product feedback channels

---

**🎉 Congratulations!** Once this checklist is complete, your team should be able to use the token system effectively without additional training. The system is designed to be intuitive and self-documenting.