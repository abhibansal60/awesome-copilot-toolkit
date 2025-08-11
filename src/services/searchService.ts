import { CatalogItem } from '../types';

export class SearchService {
  /**
   * Search items by keywords. No minimum limit required.
   * @param items - The catalog items to search through
   * @param keywords - Space-separated keywords
   * @returns Filtered items that match the search criteria
   */
  searchByKeywords(items: CatalogItem[], keywords: string): CatalogItem[] {
    const keywordArray = keywords.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
    
    // No minimum limit - allow single keyword searches
    if (keywordArray.length === 0) {
      return [];
    }

    return items.filter(item => {
      // Only use cheap fields (title, path segments, type). Avoid description to keep on-demand fetch.
      const searchableText = [
        item.title.toLowerCase(),
        item.type.toLowerCase(),
        ...item.path.toLowerCase().split(/[/\\]/)
      ].join(' ');

      // Check if ALL keywords are present in the searchable text
      return keywordArray.every(keyword => searchableText.includes(keyword));
    });
  }

  /**
   * Get search suggestions based on available items
   * @param items - The catalog items to analyze
   * @returns Array of suggested keyword combinations
   */
  getSearchSuggestions(items: CatalogItem[]): string[] {
    const suggestions: string[] = [];
    
    // Common technology keywords
    const techKeywords = [
      'azure', 'dotnet', 'csharp', 'typescript', 'react', 'angular', 'vue',
      'python', 'java', 'spring', 'docker', 'kubernetes', 'terraform',
      'sql', 'postgresql', 'playwright', 'testing', 'devops', 'security'
    ];

    // Common workflow keywords
    const workflowKeywords = [
      'code review', 'testing', 'deployment', 'architecture', 'documentation',
      'best practices', 'performance', 'optimization', 'security', 'monitoring'
    ];

    // Generate some helpful combinations
    suggestions.push('azure');
    suggestions.push('dotnet');
    suggestions.push('react');
    suggestions.push('typescript');
    suggestions.push('python');
    suggestions.push('testing');
    suggestions.push('docker');
    suggestions.push('kubernetes');
    suggestions.push('azure dotnet');
    suggestions.push('react typescript');
    suggestions.push('python testing');
    suggestions.push('docker kubernetes');

    return suggestions;
  }

  /**
   * Validate if the search query meets basic requirements
   * @param query - The search query
   * @returns Object with validation result and suggestions
   */
  validateSearchQuery(query: string): {
    isValid: boolean;
    keywordCount: number;
    requiredCount: number;
    suggestions: string[];
  } {
    const keywordArray = query.trim().toLowerCase().split(/\s+/).filter(k => k.length > 0);
    const isValid = keywordArray.length > 0;
    
    return {
      isValid,
      keywordCount: keywordArray.length,
      requiredCount: 1,
      suggestions: this.getSearchSuggestions([])
    };
  }
}
